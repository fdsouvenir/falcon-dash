import { registerCommand } from './registry';
import { trackSessionCreated } from '$lib/stores/usage';

registerCommand({
	name: 'new',
	description: 'Create a new chat session',
	usage: '/new [session name]',
	async execute(args, context) {
		try {
			const res = await context.gateway.call<{ session: { key: string; displayName: string } }>(
				'sessions.create',
				args.trim() ? { displayName: args.trim() } : {}
			);
			trackSessionCreated();
			context.insertLocalMessage(
				context.sessionKey,
				'system',
				`New session created: **${res.session.displayName}**`
			);
		} catch (err) {
			context.insertLocalMessage(
				context.sessionKey,
				'system',
				`Failed to create session: ${err instanceof Error ? err.message : String(err)}`
			);
		}
	}
});
