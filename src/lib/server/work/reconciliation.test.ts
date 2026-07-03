// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gatewayCalls = vi.hoisted(
	() => [] as Array<{ method: string; params?: Record<string, unknown> }>
);

vi.mock('../gateway-client.js', () => ({
	getGatewayClient: () => ({
		state: 'ready',
		snapshot: { snapshot: { sessionDefaults: { defaultAgentId: 'main' } } },
		call: async (method: string, params?: Record<string, unknown>) => {
			gatewayCalls.push({ method, params });
			return {};
		}
	})
}));

import {
	closeWorkDb,
	createContextualAgentSession,
	createWorkItem,
	createWorkRelationship,
	getWorkItem,
	listReconciliationRunsForItem,
	reconcileWorkItem,
	resetWorkSchemaForTests,
	updateWorkItem
} from './index.js';

let tempDir: string;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), 'falcon-work-reconcile-'));
	process.env.FALCON_DASH_WORK_DATABASE_PATH = join(tempDir, 'work.db');
	closeWorkDb();
	resetWorkSchemaForTests();
	gatewayCalls.length = 0;
});

afterEach(() => {
	closeWorkDb();
	resetWorkSchemaForTests();
	delete process.env.FALCON_DASH_WORK_DATABASE_PATH;
	rmSync(tempDir, { recursive: true, force: true });
});

describe('Work reconciliation', () => {
	it('cascades completed gated work and advances the project next move', async () => {
		const project = createWorkItem({
			type: 'project',
			title: 'Miami trip',
			status: 'in_progress',
			next_action: 'Choose Miami flights',
			actor: 'agent'
		});
		const booking = createWorkItem({
			type: 'task',
			parent_item_id: project.id,
			title: 'Book approved Miami flights',
			status: 'complete',
			result: 'United flights booked.',
			actor: 'agent'
		});
		const flightDecision = createWorkItem({
			type: 'decision',
			parent_item_id: project.id,
			title: 'Choose and approve Miami flight booking',
			status: 'needs_review',
			waiting_on: 'operator',
			actor: 'agent'
		});
		const lodging = createWorkItem({
			type: 'task',
			parent_item_id: project.id,
			title: 'Lodging and ground logistics',
			status: 'ready',
			next_action: 'Book lodging near the event',
			actor: 'agent'
		});
		createWorkRelationship({
			from_item_id: booking.id,
			to_item_id: flightDecision.id,
			relation_type: 'depends_on',
			actor: 'agent'
		});

		const { run } = await reconcileWorkItem(booking.id);

		expect(run.status).toBe('applied');
		expect(getWorkItem(flightDecision.id)).toMatchObject({
			status: 'complete',
			waiting_on: null
		});
		expect(getWorkItem(project.id)?.next_action).toContain(lodging.next_action);
		expect(gatewayCalls).toEqual([]);
	});

	it('clears downstream blocked work only after all graph blockers are closed', async () => {
		const project = createWorkItem({
			type: 'project',
			title: 'Launch project',
			status: 'in_progress',
			actor: 'agent'
		});
		const blockerOne = createWorkItem({
			type: 'task',
			parent_item_id: project.id,
			title: 'Resolve first blocker',
			status: 'complete',
			actor: 'agent'
		});
		const blockerTwo = createWorkItem({
			type: 'task',
			parent_item_id: project.id,
			title: 'Resolve second blocker',
			status: 'waiting',
			actor: 'agent'
		});
		const downstream = createWorkItem({
			type: 'task',
			parent_item_id: project.id,
			title: 'Continue delivery',
			status: 'blocked',
			waiting_on: 'external',
			actor: 'agent'
		});
		createWorkRelationship({
			from_item_id: blockerOne.id,
			to_item_id: downstream.id,
			relation_type: 'blocks',
			actor: 'agent'
		});
		createWorkRelationship({
			from_item_id: blockerTwo.id,
			to_item_id: downstream.id,
			relation_type: 'blocks',
			actor: 'agent'
		});

		await reconcileWorkItem(blockerOne.id);
		expect(getWorkItem(downstream.id)).toMatchObject({
			status: 'blocked',
			waiting_on: 'external'
		});

		updateWorkItem(blockerTwo.id, {
			status: 'complete',
			waiting_on: null,
			actor: 'agent'
		});
		await reconcileWorkItem(blockerTwo.id);
		expect(getWorkItem(downstream.id)).toMatchObject({
			status: 'ready',
			waiting_on: null
		});
	});

	it('does not infer from unlinked findings and opens an agent reconciliation session', async () => {
		const project = createWorkItem({
			type: 'project',
			title: 'Trip planning',
			status: 'in_progress',
			actor: 'agent'
		});
		const finding = createWorkItem({
			type: 'observation',
			parent_item_id: project.id,
			title: 'Flight confirmation found',
			status: 'complete',
			description: 'Confirmation email says the flight was booked.',
			actor: 'agent'
		});
		const decision = createWorkItem({
			type: 'decision',
			parent_item_id: project.id,
			title: 'Choose flight',
			status: 'needs_review',
			waiting_on: 'operator',
			actor: 'agent'
		});

		const { run } = await reconcileWorkItem(finding.id);

		expect(getWorkItem(decision.id)).toMatchObject({
			status: 'needs_review',
			waiting_on: 'operator'
		});
		expect(run.status).toBe('agent_running');
		expect(run.ambiguities.join('\n')).toContain('not linked to open operator questions');
		expect(gatewayCalls.map((call) => call.method)).toEqual(['sessions.patch', 'chat.send']);
		expect(gatewayCalls[1]?.params?.message).toContain('Do not reply with prose only');
	});

	it('creates contextual agent sessions with Work-scoped prompts', async () => {
		const project = createWorkItem({
			type: 'project',
			title: 'Customer onboarding',
			status: 'in_progress',
			actor: 'agent'
		});

		const result = await createContextualAgentSession(project.id, {
			mode: 'ask',
			message: 'What is the next safest action?'
		});

		expect(result.sessionKey).toMatch(/^agent:main:falcon:dm:fd-chat-/);
		expect(gatewayCalls[0]).toMatchObject({
			method: 'sessions.patch',
			params: { label: `Project ${project.id} · Ask Agent` }
		});
		expect(gatewayCalls[1]).toMatchObject({
			method: 'chat.send',
			params: { sessionKey: result.sessionKey, message: 'What is the next safest action?' }
		});
		expect(listReconciliationRunsForItem(project.id)[0]).toMatchObject({
			status: 'agent_running',
			session_key: result.sessionKey
		});
	});
});
