import { registerCommand } from './registry';

const VALID_LEVELS = ['off', 'on', 'stream'];

registerCommand({
	name: 'reasoning',
	description: 'Set thinking level (off, on, stream)',
	usage: '/reasoning [off|on|stream]',
	execute(args, context) {
		const level = args.trim().toLowerCase();
		if (!level) {
			context.insertLocalMessage(
				context.sessionKey,
				'system',
				'Usage: `/reasoning [off|on|stream]`'
			);
			return;
		}
		if (!VALID_LEVELS.includes(level)) {
			context.insertLocalMessage(
				context.sessionKey,
				'system',
				`Invalid level "${level}". Use: off, on, or stream.`
			);
			return;
		}
		context.updateSession(context.sessionKey, { thinkingLevel: level });
		context.insertLocalMessage(context.sessionKey, 'system', `Thinking level set to **${level}**.`);
	}
});
