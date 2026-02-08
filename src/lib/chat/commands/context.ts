import { registerCommand } from './registry';

registerCommand({
	name: 'context',
	description: 'Show context window information',
	async execute(args, context) {
		try {
			const res = await context.gateway.call<{
				maxTokens?: number;
				usedTokens?: number;
				remainingTokens?: number;
			}>('chat.context', { sessionKey: context.sessionKey });
			const lines = ['**Context Window**', ''];
			if (res.maxTokens !== undefined) lines.push(`- **Max tokens:** ${res.maxTokens}`);
			if (res.usedTokens !== undefined) lines.push(`- **Used tokens:** ${res.usedTokens}`);
			if (res.remainingTokens !== undefined) lines.push(`- **Remaining:** ${res.remainingTokens}`);
			if (lines.length === 2) {
				lines.push('No context information available.');
			}
			context.insertLocalMessage(context.sessionKey, 'system', lines.join('\n'));
		} catch (err) {
			context.insertLocalMessage(
				context.sessionKey,
				'system',
				`Failed to get context info: ${err instanceof Error ? err.message : String(err)}`
			);
		}
	}
});
