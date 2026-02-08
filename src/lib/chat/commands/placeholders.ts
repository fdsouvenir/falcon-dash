import { commands, registerCommand } from './registry';

registerCommand({
	name: 'help',
	description: 'Show available commands',
	execute(args, context) {
		const lines = ['**Available Commands**', ''];
		for (const cmd of commands) {
			lines.push(`- **/${cmd.name}** — ${cmd.description}`);
		}
		context.insertLocalMessage(context.sessionKey, 'system', lines.join('\n'));
	}
});
