import { registerCommand } from './registry';

registerCommand({
	name: 'send',
	description: 'Send a message (useful for messages starting with /)',
	usage: '/send [message]',
	execute(args, context) {
		const message = args.trim();
		if (!message) {
			context.insertLocalMessage(context.sessionKey, 'system', 'Usage: `/send [message]`');
			return;
		}
		context.sendMessage(message);
	}
});
