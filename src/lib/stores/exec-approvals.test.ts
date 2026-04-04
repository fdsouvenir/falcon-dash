import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import {
	addPendingApproval,
	addToDenylist,
	pendingApprovals,
	resetExecApprovalsForTests,
	resolveApproval
} from './exec-approvals.js';

type RpcCall = {
	method: string;
	params: Record<string, unknown> | undefined;
};

const rpcCalls: RpcCall[] = [];

beforeEach(() => {
	resetExecApprovalsForTests();
	localStorage.clear();
	rpcCalls.length = 0;

	vi.stubGlobal(
		'fetch',
		vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			const body = init?.body ? JSON.parse(String(init.body)) : {};
			rpcCalls.push({
				method: body.method as string,
				params: body.params as Record<string, unknown> | undefined
			});

			return {
				json: async () => ({ ok: true, payload: {} })
			} as Response;
		})
	);
});

async function flushPromises(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

describe('exec approvals store', () => {
	it('adds pending approvals with session context from the event payload', () => {
		const added = addPendingApproval({
			id: 'req-1',
			timestamp: 1712345678901,
			request: {
				command: 'npm publish',
				agentId: 'agent-alpha',
				sessionKey: 'agent:agent-alpha:falcon:dm:fd-chat-1234'
			}
		});

		expect(added).toBe(false);
		expect(get(pendingApprovals)).toEqual([
			{
				requestId: 'req-1',
				command: 'npm publish',
				agentId: 'agent-alpha',
				sessionKey: 'agent:agent-alpha:falcon:dm:fd-chat-1234',
				timestamp: 1712345678901
			}
		]);
	});

	it('resolves approvals and notifies the originating session', async () => {
		addPendingApproval({
			id: 'req-2',
			request: {
				command: 'git push',
				agentId: 'agent-beta',
				sessionKey: 'agent:agent-beta:falcon:dm:fd-chat-origin'
			}
		});

		await resolveApproval('req-2', 'allow-once');

		expect(get(pendingApprovals)).toEqual([]);
		expect(rpcCalls).toEqual([
			{
				method: 'exec.approval.resolve',
				params: { id: 'req-2', decision: 'allow-once' }
			},
			{
				method: 'chat.send',
				params: expect.objectContaining({
					sessionKey: 'agent:agent-beta:falcon:dm:fd-chat-origin',
					message: '[Exec approved] git push',
					deliver: false
				})
			}
		]);
	});

	it('auto-denies denylisted commands and reports back to the same session', async () => {
		addToDenylist('rm -rf /tmp/falcon');

		const denied = addPendingApproval({
			id: 'req-3',
			request: {
				command: 'rm -rf /tmp/falcon',
				agentId: 'agent-gamma',
				sessionKey: 'agent:agent-gamma:falcon:dm:fd-chat-risky'
			}
		});

		await flushPromises();

		expect(denied).toBe(true);
		expect(get(pendingApprovals)).toEqual([]);
		expect(rpcCalls).toEqual([
			{
				method: 'exec.approval.resolve',
				params: { id: 'req-3', decision: 'deny' }
			},
			{
				method: 'chat.send',
				params: expect.objectContaining({
					sessionKey: 'agent:agent-gamma:falcon:dm:fd-chat-risky',
					message: '[Exec denied (denylist)] rm -rf /tmp/falcon',
					deliver: false
				})
			}
		]);
	});
});
