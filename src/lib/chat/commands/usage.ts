import { registerCommand } from './registry';
import { getUsageStats } from '$lib/stores/usage';

registerCommand({
	name: 'usage',
	description: 'Show usage statistics',
	execute(args, context) {
		const stats = getUsageStats();
		const uptime = Math.round((Date.now() - stats.firstUsed) / (1000 * 60 * 60));
		const lines = [
			'**Usage Statistics**',
			'',
			`- **Messages sent:** ${stats.messagesSent}`,
			`- **Commands used:** ${stats.commandsUsed}`,
			`- **Sessions created:** ${stats.sessionsCreated}`,
			`- **Tracking since:** ${uptime < 1 ? 'less than 1 hour' : `${uptime} hours`} ago`
		];
		context.insertLocalMessage(context.sessionKey, 'system', lines.join('\n'));
	}
});
