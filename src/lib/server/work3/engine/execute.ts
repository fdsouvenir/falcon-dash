import { createHash } from 'node:crypto';
import { Work3Error } from '$lib/work3-shared/errors.js';
import type { Actor, CommandSuccess, Work3Event } from '$lib/work3-shared/types.js';
import { getWork3Db } from '../db.js';
import { bumpEntityVersion, loadEntity } from '../envelope.js';
import { emitWork3Event } from '../bus.js';
import { kickWork3Outbox } from '../outbox.js';
import { ulid } from '../ulid.js';
import { getCommand, listCommandNames, type DomainEventInput } from './registry.js';

/**
 * Two-phase transition engine (doc 06):
 *   1. async pre-guards (source-ref resolution, authorization recheck, ...)
 *   2. one synchronous better-sqlite3 transaction: idempotency lookup, load
 *      target + expected_version check, sync guards, mutation, version bump,
 *      outbox insert, idempotency record
 *   3. post-commit: in-process bus emit + outbox transfer kick
 *
 * The in-transaction version check protects against races during the async
 * phase: if the record changed while a pre-guard was in flight, the command
 * fails with version_conflict instead of committing on stale state.
 */

export interface CommandInput {
	command: string;
	actor: Actor;
	target?: string | null;
	expected_version?: number;
	idempotency_key?: string;
	payload?: Record<string, unknown>;
}

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, v]) => v !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
	return `{${entries.join(',')}}`;
}

function payloadHash(payload: Record<string, unknown>): string {
	return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function actorKey(actor: Actor): string {
	return `${actor.kind}:${actor.id}`;
}

interface IdempotencyRow {
	payload_hash: string;
	result_json: string;
}

export async function executeCommand<TResult = unknown>(
	input: CommandInput
): Promise<CommandSuccess<TResult>> {
	const definition = getCommand(input.command);
	if (!definition) {
		throw new Work3Error('unknown_command', `Unknown command: ${input.command}`, {
			alternatives: listCommandNames()
		});
	}

	const payload = input.payload ?? {};
	const targetId = input.target ?? null;
	const actor = input.actor;

	if (definition.requiresTarget && !targetId) {
		throw new Work3Error('validation_failed', `Command ${definition.name} requires a target`, {
			details: { command: definition.name }
		});
	}
	const needsExpectedVersion = definition.requiresExpectedVersion ?? definition.requiresTarget;
	if (needsExpectedVersion && typeof input.expected_version !== 'number') {
		throw new Work3Error(
			'validation_failed',
			`Command ${definition.name} requires expected_version`,
			{ details: { command: definition.name, target: targetId } }
		);
	}

	definition.validate?.(payload);

	const db = getWork3Db();

	// Phase 1: async pre-guards against a pre-transaction snapshot.
	if (definition.preGuards?.length) {
		const envelope = targetId ? loadEntity(db, targetId) : null;
		if (definition.requiresTarget && !envelope) {
			throw new Work3Error('not_found', `No such object: ${targetId}`, {
				details: { target: targetId }
			});
		}
		for (const preGuard of definition.preGuards) {
			await preGuard({ db, actor, targetId, envelope, payload });
		}
	}

	// Phase 2: one synchronous transaction.
	const now = Date.now();
	const run = db.transaction((): CommandSuccess<TResult> => {
		if (input.idempotency_key) {
			const existing = db
				.prepare(
					`SELECT payload_hash, result_json FROM idempotency_keys
					 WHERE key = ? AND command = ? AND target = ? AND actor_key = ?`
				)
				.get(input.idempotency_key, definition.name, targetId ?? '', actorKey(actor)) as
				| IdempotencyRow
				| undefined;
			if (existing) {
				if (existing.payload_hash !== payloadHash(payload)) {
					throw new Work3Error(
						'idempotency_conflict',
						'Idempotency key was already used with a different payload',
						{ details: { command: definition.name, idempotency_key: input.idempotency_key } }
					);
				}
				const stored = JSON.parse(existing.result_json) as CommandSuccess<TResult>;
				return { ...stored, replayed: true };
			}
		}

		const envelope = targetId ? loadEntity(db, targetId) : null;
		if (definition.requiresTarget) {
			if (!envelope) {
				throw new Work3Error('not_found', `No such object: ${targetId}`, {
					details: { target: targetId }
				});
			}
			if (definition.targetType && envelope.type !== definition.targetType) {
				throw new Work3Error(
					'validation_failed',
					`Command ${definition.name} targets ${definition.targetType}, got ${envelope.type}`,
					{ details: { target: targetId, target_type: envelope.type } }
				);
			}
			if (needsExpectedVersion && envelope.version !== input.expected_version) {
				throw new Work3Error('version_conflict', 'Object changed since it was read', {
					details: {
						target: targetId,
						current_version: envelope.version,
						expected_version: input.expected_version
					}
				});
			}
		}

		const ctx = { db, now, actor, targetId, envelope, payload };
		for (const guard of definition.guards ?? []) {
			guard(ctx);
		}

		const outcome = definition.execute(ctx);

		let versionTo: number | null = envelope?.version ?? null;
		if (!outcome.noop && definition.requiresTarget && envelope) {
			versionTo = bumpEntityVersion(db, envelope.id, envelope.version, now);
			if (versionTo === null) {
				throw new Work3Error('invariant_violation', 'Envelope version changed mid-transaction', {
					details: { target: envelope.id }
				});
			}
		}

		const events: Work3Event[] = outcome.noop
			? []
			: outcome.events.map((event: DomainEventInput) => ({
					id: ulid(now),
					occurred_at: now,
					command: definition.name,
					event_type: event.event_type,
					subject_type: event.subject_type,
					subject_id: event.subject_id,
					actor,
					version_from:
						event.version_from !== undefined
							? event.version_from
							: event.subject_id === targetId
								? (envelope?.version ?? null)
								: null,
					version_to:
						event.version_to !== undefined
							? event.version_to
							: event.subject_id === targetId
								? versionTo
								: null,
					summary: event.summary,
					payload: event.payload ?? {},
					source_refs: event.source_refs ?? []
				}));

		const insertOutbox = db.prepare(
			`INSERT INTO event_outbox (
				id, occurred_at, command, event_type, subject_type, subject_id,
				actor_kind, actor_id, actor_label, version_from, version_to,
				summary, payload_json, source_refs_json
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		);
		for (const event of events) {
			insertOutbox.run(
				event.id,
				event.occurred_at,
				event.command,
				event.event_type,
				event.subject_type,
				event.subject_id,
				event.actor.kind,
				event.actor.id,
				event.actor.label,
				event.version_from,
				event.version_to,
				event.summary,
				JSON.stringify(event.payload),
				JSON.stringify(event.source_refs)
			);
		}

		const success: CommandSuccess<TResult> = {
			ok: true,
			command: definition.name,
			result: outcome.result as TResult,
			events,
			replayed: false,
			noop: outcome.noop ?? false
		};

		if (input.idempotency_key) {
			db.prepare(
				`INSERT INTO idempotency_keys (key, command, target, actor_key, payload_hash, result_json, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			).run(
				input.idempotency_key,
				definition.name,
				targetId ?? '',
				actorKey(actor),
				payloadHash(payload),
				JSON.stringify(success),
				now
			);
		}

		return success;
	});

	const success = run();

	// Phase 3: post-commit side effects. Replays already published their events.
	if (!success.replayed && success.events.length > 0) {
		for (const event of success.events) {
			emitWork3Event(event);
		}
		kickWork3Outbox();
	}

	return success;
}
