import { registerCommand } from './registry';
import { get } from 'svelte/store';
import { sessions, activeRun, messages } from '$lib/stores';

registerCommand({
	name: 'status',
	description: 'Show session status and metadata',
	execute(args, context) {
		const sessionMap = get(sessions);
		const session = sessionMap.get(context.sessionKey);
		const run = get(activeRun);
		const allMessages = get(messages);
		const sessionMessages = allMessages.get(context.sessionKey) ?? [];
		const msgCount = sessionMessages.filter((m) => !m.localOnly).length;

		const lines: string[] = ['**Session Status**', ''];
		if (session) {
			lines.push(`- **Name:** ${session.displayName}`);
			lines.push(`- **Key:** \`${session.key}\``);
			lines.push(`- **Model:** ${session.model || 'Default'}`);
			lines.push(`- **Thinking:** ${session.thinkingLevel || 'off'}`);
			lines.push(`- **Messages:** ${msgCount}`);
		} else {
			lines.push('No active session.');
		}

		if (run) {
			lines.push(`- **Run:** ${run.status} (${run.runId})`);
		}

		context.insertLocalMessage(context.sessionKey, 'system', lines.join('\n'));
	}
});
