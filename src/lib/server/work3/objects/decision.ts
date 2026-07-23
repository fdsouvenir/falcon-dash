import type Database from 'better-sqlite3';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { allocateEntityId, insertEntity } from '../envelope.js';
import { humanAuthorityPreGuard, extractAuthoritySource } from '../engine/authority.js';
import { registerCommand, type ExecuteContext } from '../engine/registry.js';
import { optionalEnum, optionalNumber, optionalString, requireString } from '../engine/validate.js';
import { appendRevision, currentRevision, revisionHistory } from '../revisions.js';
import { requireActiveArea } from './area.js';
import { TASK_PRIORITIES } from './task.js';

/**
 * Decision (docs 01–02): created decision-ready directly as pending — no
 * draft, no submit. pending ↔ deferred, → decided | withdrawn. Packages and
 * outcomes are immutable; changed commitments require a superseding Decision.
 * `decide` is authority-creating and carries the human-authority guard.
 */

export interface DecisionRow {
	entity_id: string;
	project_id: string | null;
	phase_id: string | null;
	status: 'pending' | 'deferred' | 'decided' | 'withdrawn';
	priority: string | null;
	needed_by: number | null;
	supersedes_decision_id: string | null;
	superseded_by: string | null;
	outcome: string | null;
	decided_at: number | null;
	deferred_reason: string | null;
	deferred_until: number | null;
	withdrawn_at: number | null;
	withdraw_reason: string | null;
}

export interface DecisionPackageRow {
	id: string;
	parent_id: string;
	supersedes: string | null;
	is_current: number;
	created_at: number;
	title: string;
	prompt: string;
	context: string | null;
	stakes: string | null;
	consequence_of_no_decision: string;
	deciders: string;
	options: string;
	recommendation: string;
}

interface DecisionOption {
	id: string;
	label: string;
	summary?: string;
	tradeoffs?: string;
	risks?: string;
}

export function loadDecision(db: Database.Database, id: string): DecisionRow | null {
	return (db.prepare('SELECT * FROM decisions WHERE entity_id = ?').get(id) as DecisionRow) ?? null;
}

export function currentPackage(
	db: Database.Database,
	decisionId: string
): DecisionPackageRow | null {
	return currentRevision<DecisionPackageRow>(db, 'decision_packages', decisionId);
}

export function packageHistory(db: Database.Database, decisionId: string): DecisionPackageRow[] {
	return revisionHistory<DecisionPackageRow>(db, 'decision_packages', decisionId);
}

function decision(ctx: ExecuteContext): DecisionRow {
	const row = loadDecision(ctx.db, ctx.targetId!);
	if (!row)
		throw new Work3Error('invariant_violation', `Decision head row missing for ${ctx.targetId}`);
	return row;
}

interface ParsedPackage {
	title: string;
	prompt: string;
	context: string | null;
	stakes: string | null;
	consequence_of_no_decision: string;
	deciders: string[];
	options: DecisionOption[];
	recommendation: { option_id: string; rationale?: string };
}

/** Validate the complete decision-ready package (doc 01 correction). */
function parsePackage(payload: Record<string, unknown>): ParsedPackage {
	const title = requireString(payload, 'title', { maxLength: 300 });
	const prompt = requireString(payload, 'prompt');
	const consequence = requireString(payload, 'consequence_of_no_decision');

	const rawDeciders = payload.deciders;
	if (
		!Array.isArray(rawDeciders) ||
		rawDeciders.length === 0 ||
		rawDeciders.some((d) => typeof d !== 'string')
	) {
		throw new Work3Error(
			'validation_failed',
			'deciders must be a non-empty array of identity strings'
		);
	}

	const rawOptions = payload.options;
	if (!Array.isArray(rawOptions) || rawOptions.length < 2) {
		throw new Work3Error(
			'validation_failed',
			'At least two materially distinct options are required'
		);
	}
	const options: DecisionOption[] = rawOptions.map((raw, index) => {
		if (!raw || typeof raw !== 'object') {
			throw new Work3Error('validation_failed', `options[${index}] must be an object`);
		}
		const candidate = raw as Record<string, unknown>;
		if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
			throw new Work3Error('validation_failed', `options[${index}].id is required (stable id)`);
		}
		if (typeof candidate.label !== 'string' || candidate.label.trim().length === 0) {
			throw new Work3Error('validation_failed', `options[${index}].label is required`);
		}
		return {
			id: candidate.id.trim(),
			label: candidate.label.trim(),
			...(typeof candidate.summary === 'string' ? { summary: candidate.summary } : {}),
			...(typeof candidate.tradeoffs === 'string' ? { tradeoffs: candidate.tradeoffs } : {}),
			...(typeof candidate.risks === 'string' ? { risks: candidate.risks } : {})
		};
	});
	const ids = new Set(options.map((option) => option.id));
	if (ids.size !== options.length) {
		throw new Work3Error('validation_failed', 'option ids must be unique');
	}
	const labels = new Set(options.map((option) => option.label.toLowerCase()));
	if (labels.size !== options.length) {
		throw new Work3Error(
			'validation_failed',
			'options must be materially distinct (duplicate labels)'
		);
	}

	const rawRecommendation = payload.recommendation;
	if (!rawRecommendation || typeof rawRecommendation !== 'object') {
		throw new Work3Error(
			'validation_failed',
			'recommendation is required ({option_id, rationale?})'
		);
	}
	const rec = rawRecommendation as Record<string, unknown>;
	if (typeof rec.option_id !== 'string' || !ids.has(rec.option_id)) {
		throw new Work3Error(
			'validation_failed',
			'recommendation.option_id must reference a listed option',
			{
				details: { option_ids: [...ids] }
			}
		);
	}

	return {
		title,
		prompt,
		context: optionalString(payload, 'context') ?? null,
		stakes: optionalString(payload, 'stakes') ?? null,
		consequence_of_no_decision: consequence,
		deciders: rawDeciders as string[],
		options,
		recommendation: {
			option_id: rec.option_id,
			...(typeof rec.rationale === 'string' ? { rationale: rec.rationale } : {})
		}
	};
}

function insertPackage(ctx: ExecuteContext, decisionId: string, parsed: ParsedPackage) {
	return appendRevision(ctx.db, 'decision_packages', {
		parentId: decisionId,
		now: ctx.now,
		columns: {
			title: parsed.title,
			prompt: parsed.prompt,
			context: parsed.context,
			stakes: parsed.stakes,
			consequence_of_no_decision: parsed.consequence_of_no_decision,
			deciders: JSON.stringify(parsed.deciders),
			options: JSON.stringify(parsed.options),
			recommendation: JSON.stringify(parsed.recommendation)
		}
	});
}

export function registerDecisionCommands(): void {
	registerCommand({
		name: 'create_decision',
		targetType: null,
		summary: 'Create a decision-ready Decision directly as pending',
		requiresTarget: false,
		validate: (payload) => {
			requireString(payload, 'area_id');
			parsePackage(payload);
			optionalEnum(payload, 'priority', TASK_PRIORITIES);
			optionalNumber(payload, 'needed_by');
		},
		execute: (ctx) => {
			const areaId = requireString(ctx.payload, 'area_id');
			requireActiveArea(ctx.db, areaId);
			const parsed = parsePackage(ctx.payload);
			const id = allocateEntityId(ctx.db, 'decision');
			insertEntity(ctx.db, { id, type: 'decision', areaId, now: ctx.now });
			ctx.db
				.prepare(`INSERT INTO decisions (entity_id, priority, needed_by) VALUES (?, ?, ?)`)
				.run(
					id,
					optionalEnum(ctx.payload, 'priority', TASK_PRIORITIES) ?? null,
					optionalNumber(ctx.payload, 'needed_by') ?? null
				);
			const revision = insertPackage(ctx, id, parsed);
			return {
				result: { id, status: 'pending', package_id: revision.id },
				events: [
					{
						event_type: 'decision_created',
						subject_type: 'decision',
						subject_id: id,
						summary: `Created Decision ${id}: ${parsed.title}`,
						version_from: null,
						version_to: 1,
						payload: { title: parsed.title, package_id: revision.id, area_id: areaId }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'revise_decision',
		targetType: 'decision',
		summary: 'Replace a pending/deferred package with a new immutable revision',
		requiresTarget: true,
		validate: (payload) => {
			parsePackage(payload);
		},
		execute: (ctx) => {
			const row = decision(ctx);
			if (row.status !== 'pending' && row.status !== 'deferred') {
				throw new Work3Error('transition_not_allowed', `Cannot revise a ${row.status} Decision`, {
					details: { status: row.status },
					alternatives: row.status === 'decided' ? ['supersede_decision'] : []
				});
			}
			const parsed = parsePackage(ctx.payload);
			const revision = insertPackage(ctx, row.entity_id, parsed);
			return {
				result: { id: row.entity_id, status: row.status, package_id: revision.id },
				events: [
					{
						event_type: 'decision_revised',
						subject_type: 'decision',
						subject_id: row.entity_id,
						summary: `Revised Decision ${row.entity_id} package`,
						payload: { package_id: revision.id, supersedes: revision.supersedes }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'decide',
		targetType: 'decision',
		summary: 'Record the immutable Decision outcome (requires human authority basis)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'option_id');
			requireString(payload, 'rationale');
		},
		preGuards: [humanAuthorityPreGuard],
		execute: (ctx) => {
			const row = decision(ctx);
			const optionId = requireString(ctx.payload, 'option_id');
			if (row.status === 'decided') {
				const outcome = JSON.parse(row.outcome!) as { option_id: string };
				if (outcome.option_id === optionId) {
					// Repeating the same authorized outcome is an idempotent no-op.
					return {
						result: { id: row.entity_id, status: 'decided', option_id: optionId },
						events: [],
						noop: true
					};
				}
				throw new Work3Error(
					'transition_not_allowed',
					'Decided commitments are immutable; changed commitments require a superseding Decision',
					{ alternatives: ['supersede_decision'] }
				);
			}
			if (row.status !== 'pending' && row.status !== 'deferred') {
				throw new Work3Error('transition_not_allowed', `Cannot decide a ${row.status} Decision`, {
					details: { status: row.status }
				});
			}
			const pkg = currentPackage(ctx.db, row.entity_id);
			if (!pkg) throw new Work3Error('invariant_violation', 'Decision has no package');
			const options = JSON.parse(pkg.options) as DecisionOption[];
			const selected = options.find((option) => option.id === optionId);
			if (!selected) {
				throw new Work3Error(
					'validation_failed',
					`option_id ${optionId} is not in the current package`,
					{
						details: { option_ids: options.map((option) => option.id), package_id: pkg.id }
					}
				);
			}
			const rationale = requireString(ctx.payload, 'rationale');
			const authoritySource = extractAuthoritySource(ctx.payload);
			const outcome = {
				option_id: selected.id,
				option_label: selected.label,
				rationale,
				package_id: pkg.id,
				decided_by: ctx.actor,
				authority_basis:
					ctx.actor.kind === 'person'
						? { kind: 'person_session', label: ctx.actor.label }
						: { kind: 'asserted_instruction', source_ref: authoritySource },
				decided_at: ctx.now
			};
			ctx.db
				.prepare(
					`UPDATE decisions SET status = 'decided', outcome = ?, decided_at = ? WHERE entity_id = ?`
				)
				.run(JSON.stringify(outcome), ctx.now, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'decided', option_id: selected.id },
				events: [
					{
						event_type: 'decision_decided',
						subject_type: 'decision',
						subject_id: row.entity_id,
						summary: `Decided ${row.entity_id}: ${selected.label}`,
						payload: { option_id: selected.id, package_id: pkg.id, rationale },
						source_refs: authoritySource ? [authoritySource] : []
					}
				]
			};
		}
	});

	registerCommand({
		name: 'defer_decision',
		targetType: 'decision',
		summary: 'Defer a pending Decision (requires a reason)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
			optionalNumber(payload, 'until');
		},
		execute: (ctx) => {
			const row = decision(ctx);
			if (row.status === 'deferred') {
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			}
			if (row.status !== 'pending') {
				throw new Work3Error('transition_not_allowed', `Cannot defer a ${row.status} Decision`, {
					details: { status: row.status }
				});
			}
			const reason = requireString(ctx.payload, 'reason');
			ctx.db
				.prepare(
					`UPDATE decisions SET status = 'deferred', deferred_reason = ?, deferred_until = ? WHERE entity_id = ?`
				)
				.run(reason, optionalNumber(ctx.payload, 'until') ?? null, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'deferred' },
				events: [
					{
						event_type: 'decision_deferred',
						subject_type: 'decision',
						subject_id: row.entity_id,
						summary: `Deferred Decision ${row.entity_id}: ${reason}`,
						payload: { reason }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'resume_decision',
		targetType: 'decision',
		summary: 'Resume a deferred Decision to pending',
		requiresTarget: true,
		execute: (ctx) => {
			const row = decision(ctx);
			if (row.status === 'pending') {
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			}
			if (row.status !== 'deferred') {
				throw new Work3Error('transition_not_allowed', `Cannot resume a ${row.status} Decision`, {
					details: { status: row.status }
				});
			}
			ctx.db
				.prepare(
					`UPDATE decisions SET status = 'pending', deferred_reason = NULL, deferred_until = NULL WHERE entity_id = ?`
				)
				.run(row.entity_id);
			return {
				result: { id: row.entity_id, status: 'pending' },
				events: [
					{
						event_type: 'decision_resumed',
						subject_type: 'decision',
						subject_id: row.entity_id,
						summary: `Resumed Decision ${row.entity_id} to pending`
					}
				]
			};
		}
	});

	registerCommand({
		name: 'withdraw_decision',
		targetType: 'decision',
		summary: 'Withdraw a pending/deferred Decision (requires a reason)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
		},
		execute: (ctx) => {
			const row = decision(ctx);
			if (row.status === 'withdrawn') {
				return { result: { id: row.entity_id, status: row.status }, events: [], noop: true };
			}
			if (row.status !== 'pending' && row.status !== 'deferred') {
				throw new Work3Error('transition_not_allowed', `Cannot withdraw a ${row.status} Decision`, {
					details: { status: row.status }
				});
			}
			const reason = requireString(ctx.payload, 'reason');
			ctx.db
				.prepare(
					`UPDATE decisions SET status = 'withdrawn', withdrawn_at = ?, withdraw_reason = ? WHERE entity_id = ?`
				)
				.run(ctx.now, reason, row.entity_id);
			return {
				result: { id: row.entity_id, status: 'withdrawn' },
				events: [
					{
						event_type: 'decision_withdrawn',
						subject_type: 'decision',
						subject_id: row.entity_id,
						summary: `Withdrew Decision ${row.entity_id}: ${reason}`,
						payload: { reason }
					}
				]
			};
		}
	});

	registerCommand({
		name: 'supersede_decision',
		targetType: 'decision',
		summary: 'Create a new pending Decision superseding a decided one',
		requiresTarget: true,
		validate: (payload) => {
			parsePackage(payload);
		},
		execute: (ctx) => {
			const row = decision(ctx);
			if (row.status !== 'decided') {
				throw new Work3Error('transition_not_allowed', 'Only decided Decisions can be superseded', {
					details: { status: row.status },
					alternatives: ['revise_decision']
				});
			}
			if (row.superseded_by) {
				// Idempotent: already superseded — return the existing successor.
				return {
					result: { id: row.entity_id, superseded_by: row.superseded_by },
					events: [],
					noop: true
				};
			}
			const parsed = parsePackage(ctx.payload);
			const successorId = allocateEntityId(ctx.db, 'decision');
			insertEntity(ctx.db, {
				id: successorId,
				type: 'decision',
				areaId: ctx.envelope!.area_id,
				now: ctx.now
			});
			ctx.db
				.prepare(
					`INSERT INTO decisions (entity_id, priority, needed_by, supersedes_decision_id) VALUES (?, ?, ?, ?)`
				)
				.run(
					successorId,
					row.priority,
					optionalNumber(ctx.payload, 'needed_by') ?? null,
					row.entity_id
				);
			const revision = insertPackage(ctx, successorId, parsed);
			ctx.db
				.prepare(`UPDATE decisions SET superseded_by = ? WHERE entity_id = ?`)
				.run(successorId, row.entity_id);
			return {
				result: {
					id: row.entity_id,
					superseded_by: successorId,
					successor_package_id: revision.id
				},
				events: [
					{
						event_type: 'decision_superseded',
						subject_type: 'decision',
						subject_id: row.entity_id,
						summary: `Decision ${row.entity_id} superseded by ${successorId}`,
						payload: { superseded_by: successorId }
					},
					{
						event_type: 'decision_created',
						subject_type: 'decision',
						subject_id: successorId,
						summary: `Created Decision ${successorId} superseding ${row.entity_id}: ${parsed.title}`,
						version_from: null,
						version_to: 1,
						payload: { title: parsed.title, supersedes: row.entity_id, package_id: revision.id }
					}
				]
			};
		}
	});
}
