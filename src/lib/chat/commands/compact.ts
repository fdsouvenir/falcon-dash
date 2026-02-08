import { registerCommand } from './registry';

registerCommand({
	name: 'compact',
	description: 'Compact the conversation context',
	async execute(args, context) {
		context.insertLocalMessage(context.sessionKey, 'system', 'Compacting context...');
		try {
			await context.gateway.call('chat.inject', {
				sessionKey: context.sessionKey,
				role: 'system',
				content: 'Please compact and summarize the conversation so far.'
			});
			context.insertLocalMessage(context.sessionKey, 'system', 'Context compaction request sent.');
		} catch (err) {
			context.insertLocalMessage(
				context.sessionKey,
				'system',
				`Compaction failed: ${err instanceof Error ? err.message : String(err)}`
			);
		}
	}
});
