import { registerCommand } from './registry';

registerCommand({
	name: 'subagents',
	description: 'List active sub-agents',
	async execute(args, context) {
		try {
			const res = await context.gateway.call<{
				agents?: Array<{ id: string; name: string; status: string }>;
			}>('agents.list', { sessionKey: context.sessionKey });
			const agents = res.agents ?? [];
			if (agents.length === 0) {
				context.insertLocalMessage(context.sessionKey, 'system', 'No active sub-agents.');
				return;
			}
			const lines = [`**Active Sub-Agents** (${agents.length})`, ''];
			for (const agent of agents) {
				lines.push(`- **${agent.name}** (\`${agent.id}\`) — ${agent.status}`);
			}
			context.insertLocalMessage(context.sessionKey, 'system', lines.join('\n'));
		} catch (err) {
			context.insertLocalMessage(
				context.sessionKey,
				'system',
				`Failed to list sub-agents: ${err instanceof Error ? err.message : String(err)}`
			);
		}
	}
});
