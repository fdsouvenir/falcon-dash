import type Database from 'better-sqlite3';
import { Work3Error } from '$lib/work3-shared/errors.js';
import { parseSourceRefs } from '$lib/work3-shared/sources.js';
import { allocateEntityId, insertEntity, loadEntity } from '../envelope.js';
import { registerCommand, type ExecuteContext } from '../engine/registry.js';
import { optionalNumber, optionalString, requireEnum, requireString } from '../engine/validate.js';

/**
 * Finding (doc 01): a durable, evidence-backed conclusion — an attached
 * knowledge artifact, never Work. Validity: current → superseded | retracted;
 * terminal Findings never return to current. Source references are required.
 */

export const FINDING_CONFIDENCES = ['tentative', 'supported', 'confirmed'] as const;

export interface FindingRow {
	entity_id: string;
	project_id: string | null;
	title: string;
	conclusion: string;
	significance: string | null;
	confidence: string;
	validity: 'current' | 'superseded' | 'retracted';
	source_refs: string;
	targets: string;
	observed_at: number | null;
	author_kind: string;
	author_id: string;
	author_label: string;
	supersedes_finding_id: string | null;
	superseded_by: string | null;
	retracted_at: number | null;
	retract_reason: string | null;
	retract_source_refs: string;
}

export function loadFinding(db: Database.Database, id: string): FindingRow | null {
	return (db.prepare('SELECT * FROM findings WHERE entity_id = ?').get(id) as FindingRow) ?? null;
}

function finding(ctx: ExecuteContext): FindingRow {
	const row = loadFinding(ctx.db, ctx.targetId!);
	if (!row)
		throw new Work3Error('invariant_violation', `Finding head row missing for ${ctx.targetId}`);
	return row;
}

function parseTargets(ctx: ExecuteContext, payload: Record<string, unknown>): string[] {
	const raw = payload.targets;
	if (raw === undefined) return [];
	if (!Array.isArray(raw) || raw.some((entry) => typeof entry !== 'string')) {
		throw new Work3Error('validation_failed', 'targets must be an array of Work/artifact ids');
	}
	for (const target of raw as string[]) {
		if (!loadEntity(ctx.db, target)) {
			throw new Work3Error('not_found', `Finding target does not exist: ${target}`);
		}
	}
	return raw as string[];
}

interface FindingFields {
	title: string;
	conclusion: string;
	significance: string | null;
	confidence: string;
	sourceRefs: ReturnType<typeof parseSourceRefs>;
	targets: string[];
	observedAt: number | null;
	areaId: string | null;
}

function parseFindingFields(ctx: ExecuteContext): FindingFields {
	return {
		title: requireString(ctx.payload, 'title', { maxLength: 300 }),
		conclusion: requireString(ctx.payload, 'conclusion'),
		significance: optionalString(ctx.payload, 'significance') ?? null,
		confidence: requireEnum(ctx.payload, 'confidence', FINDING_CONFIDENCES),
		// A Finding requires source references (doc 01).
		sourceRefs: parseSourceRefs(ctx.payload.source_refs, { required: true }),
		targets: parseTargets(ctx, ctx.payload),
		observedAt: optionalNumber(ctx.payload, 'observed_at') ?? null,
		areaId: optionalString(ctx.payload, 'area_id') ?? null
	};
}

function insertFinding(
	ctx: ExecuteContext,
	fields: FindingFields,
	supersedesId: string | null
): string {
	const id = allocateEntityId(ctx.db, 'finding');
	insertEntity(ctx.db, { id, type: 'finding', areaId: fields.areaId, now: ctx.now });
	ctx.db
		.prepare(
			`INSERT INTO findings (entity_id, title, conclusion, significance, confidence, source_refs,
			 targets, observed_at, author_kind, author_id, author_label, supersedes_finding_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			id,
			fields.title,
			fields.conclusion,
			fields.significance,
			fields.confidence,
			JSON.stringify(fields.sourceRefs),
			JSON.stringify(fields.targets),
			fields.observedAt,
			ctx.actor.kind,
			ctx.actor.id,
			ctx.actor.label,
			supersedesId
		);
	return id;
}

export function registerFindingCommands(): void {
	registerCommand({
		name: 'create_finding',
		targetType: null,
		summary: 'Record a durable evidence-backed conclusion (sources required)',
		requiresTarget: false,
		validate: (payload) => {
			requireString(payload, 'title', { maxLength: 300 });
			requireString(payload, 'conclusion');
			requireEnum(payload, 'confidence', FINDING_CONFIDENCES);
			parseSourceRefs(payload.source_refs, { required: true });
		},
		execute: (ctx) => {
			const fields = parseFindingFields(ctx);
			const id = insertFinding(ctx, fields, null);
			return {
				result: { id, validity: 'current', confidence: fields.confidence },
				events: [
					{
						event_type: 'finding_created',
						subject_type: 'finding',
						subject_id: id,
						summary: `Recorded Finding ${id}: ${fields.title}`,
						version_from: null,
						version_to: 1,
						payload: {
							title: fields.title,
							confidence: fields.confidence,
							targets: fields.targets
						},
						source_refs: fields.sourceRefs
					}
				]
			};
		}
	});

	registerCommand({
		name: 'supersede_finding',
		targetType: 'finding',
		summary: 'Replace a Finding with a corrected one (history preserved)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'title', { maxLength: 300 });
			requireString(payload, 'conclusion');
			requireEnum(payload, 'confidence', FINDING_CONFIDENCES);
			parseSourceRefs(payload.source_refs, { required: true });
		},
		execute: (ctx) => {
			const row = finding(ctx);
			if (row.validity === 'superseded' && row.superseded_by) {
				return {
					result: { id: row.entity_id, superseded_by: row.superseded_by },
					events: [],
					noop: true
				};
			}
			if (row.validity === 'retracted') {
				throw new Work3Error('transition_not_allowed', 'Retracted Findings cannot be superseded', {
					alternatives: ['create_finding']
				});
			}
			const fields = parseFindingFields(ctx);
			const successorId = insertFinding(
				ctx,
				{ ...fields, areaId: fields.areaId ?? ctx.envelope!.area_id },
				row.entity_id
			);
			ctx.db
				.prepare(
					`UPDATE findings SET validity = 'superseded', superseded_by = ? WHERE entity_id = ?`
				)
				.run(successorId, row.entity_id);
			return {
				result: { id: row.entity_id, superseded_by: successorId },
				events: [
					{
						event_type: 'finding_superseded',
						subject_type: 'finding',
						subject_id: row.entity_id,
						summary: `Finding ${row.entity_id} superseded by ${successorId}`,
						payload: { superseded_by: successorId }
					},
					{
						event_type: 'finding_created',
						subject_type: 'finding',
						subject_id: successorId,
						summary: `Recorded Finding ${successorId} superseding ${row.entity_id}: ${fields.title}`,
						version_from: null,
						version_to: 1,
						payload: {
							title: fields.title,
							confidence: fields.confidence,
							supersedes: row.entity_id
						},
						source_refs: fields.sourceRefs
					}
				]
			};
		}
	});

	registerCommand({
		name: 'retract_finding',
		targetType: 'finding',
		summary: 'Retract a Finding (requires reason; corrective sources when applicable)',
		requiresTarget: true,
		validate: (payload) => {
			requireString(payload, 'reason');
		},
		execute: (ctx) => {
			const row = finding(ctx);
			if (row.validity === 'retracted') {
				return { result: { id: row.entity_id, validity: row.validity }, events: [], noop: true };
			}
			if (row.validity === 'superseded') {
				throw new Work3Error('transition_not_allowed', 'Superseded Findings cannot be retracted', {
					details: { superseded_by: row.superseded_by }
				});
			}
			const reason = requireString(ctx.payload, 'reason');
			const sourceRefs = parseSourceRefs(ctx.payload.source_refs);
			ctx.db
				.prepare(
					`UPDATE findings SET validity = 'retracted', retracted_at = ?, retract_reason = ?,
					 retract_source_refs = ? WHERE entity_id = ?`
				)
				.run(ctx.now, reason, JSON.stringify(sourceRefs), row.entity_id);
			return {
				result: { id: row.entity_id, validity: 'retracted' },
				events: [
					{
						event_type: 'finding_retracted',
						subject_type: 'finding',
						subject_id: row.entity_id,
						summary: `Retracted Finding ${row.entity_id}: ${reason}`,
						payload: { reason },
						source_refs: sourceRefs
					}
				]
			};
		}
	});
}
