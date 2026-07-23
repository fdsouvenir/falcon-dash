import type Database from 'better-sqlite3';
import type { Actor, EntityEnvelope, SourceRef } from '$lib/work3-shared/types.js';

/**
 * Command registry (doc 06): per-object semantic command definitions as data.
 * The registry is the single source of truth for execution, HTTP routing, CLI
 * help, and the "valid alternatives" lists inside structured errors.
 */

export interface PreGuardContext {
	/** Read-only handle; pre-guards must not mutate canonical state. */
	db: Database.Database;
	actor: Actor;
	targetId: string | null;
	/** Envelope snapshot loaded before the async phase; may be stale by commit time. */
	envelope: EntityEnvelope | null;
	payload: Record<string, unknown>;
}

export interface ExecuteContext {
	db: Database.Database;
	now: number;
	actor: Actor;
	targetId: string | null;
	/** Reloaded inside the transaction; the expected_version check has passed. */
	envelope: EntityEnvelope | null;
	payload: Record<string, unknown>;
}

export interface DomainEventInput {
	event_type: string;
	subject_type: string;
	subject_id: string;
	summary: string;
	/** Defaults to the target's version transition when the subject is the target. */
	version_from?: number | null;
	version_to?: number | null;
	payload?: Record<string, unknown>;
	source_refs?: SourceRef[];
}

export interface ExecuteOutcome<TResult = unknown> {
	result: TResult;
	events: DomainEventInput[];
	/**
	 * True when the transition was already achieved (idempotent semantic no-op,
	 * doc 02). No version bump, no events, successful response.
	 */
	noop?: boolean;
}

export interface CommandDefinition<TResult = unknown> {
	name: string;
	/** Entity type the command targets; null for commands that create their target. */
	targetType: string | null;
	summary: string;
	requiresTarget: boolean;
	/** Defaults to requiresTarget. Optimistic concurrency per doc 02. */
	requiresExpectedVersion?: boolean;
	/** Informational (errors/help); guards do the enforcement. */
	legalSourceStates?: string[];
	/** Throws Work3Error('validation_failed') on bad payload shape. */
	validate?: (payload: Record<string, unknown>) => void;
	/** Async phase: source-ref resolution, authorization recheck, gateway ops. */
	preGuards?: Array<(ctx: PreGuardContext) => Promise<void>>;
	/** Sync guards inside the transaction. Throw Work3Error to reject. */
	guards?: Array<(ctx: ExecuteContext) => void>;
	/** Sync mutation inside the transaction. */
	execute: (ctx: ExecuteContext) => ExecuteOutcome<TResult>;
}

const registry = new Map<string, CommandDefinition>();

export function registerCommand(definition: CommandDefinition): void {
	if (registry.has(definition.name)) {
		throw new Error(`work3 command registered twice: ${definition.name}`);
	}
	registry.set(definition.name, definition);
}

export function getCommand(name: string): CommandDefinition | undefined {
	return registry.get(name);
}

export function listCommands(): CommandDefinition[] {
	return [...registry.values()];
}

export function listCommandNames(): string[] {
	return [...registry.keys()].sort();
}

/** Test-only: clear registrations between suites. */
export function resetRegistryForTests(): void {
	registry.clear();
}
