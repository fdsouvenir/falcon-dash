import { registerCommand } from './registry';

registerCommand({
	name: 'stop',
	description: 'Stop the active agent run',
	execute(args, context) {
		context.abortRun();
		context.insertLocalMessage(context.sessionKey, 'system', 'Run aborted.');
	}
});
