import { call } from '$lib/stores/gateway.js';

export interface SlashCommand {
	name: string;
	description: string;
	args?: string; // argument hint, e.g. "[model]"
	handler: (args: string, context: CommandContext) => Promise<void>;
}

export interface CommandContext {
	sessionKey: string;
	abort: () => Promise<void>;
}

export const commands: SlashCommand[] = [
	{
		name: 'new',
		description: 'Start a new session',
		args: '[model]',
		handler: async (args, ctx) => {
			const params: Record<string, unknown> = { sessionKey: ctx.sessionKey };
			if (args.trim()) params.model = args.trim();
			await call('sessions.reset', params);
		}
	},
	{
		name: 'stop',
		description: 'Stop the active agent run',
		handler: async (_args, ctx) => {
			await ctx.abort();
		}
	},
	{
		name: 'reasoning',
		description: 'Set thinking level',
		args: '[off|minimal|low|medium|high|xhigh]',
		handler: async (args, ctx) => {
			const level = args.trim() || 'medium';
			await call('sessions.patch', { sessionKey: ctx.sessionKey, thinkingLevel: level });
		}
	},
	{
		name: 'compact',
		description: 'Compact conversation history',
		args: '[instructions]',
		handler: async (args, ctx) => {
			const params: Record<string, unknown> = { sessionKey: ctx.sessionKey };
			if (args.trim()) params.instructions = args.trim();
			await call('sessions.compact', params);
		}
	},
	{
		name: 'status',
		description: 'Show session status',
		handler: async () => {
			// Status is displayed by the UI — this is a no-op command that triggers a status display
		}
	},
	{
		name: 'usage',
		description: 'Show token usage for this session',
		handler: async () => {
			// Usage display triggered by UI
		}
	},
	{
		name: 'verbose',
		description: 'Toggle verbose output mode',
		handler: async () => {
			// Handled by UI state
		}
	},
	{
		name: 'context',
		description: 'Show context window usage',
		handler: async () => {
			// Display triggered by UI
		}
	},
	{
		name: 'subagents',
		description: 'Show active subagent runs',
		handler: async () => {
			// Display triggered by UI
		}
	},
	{
		name: 'send',
		description: 'Send message to a specific session',
		args: '<sessionKey> <message>',
		handler: async (args) => {
			const spaceIdx = args.indexOf(' ');
			if (spaceIdx < 0) return;
			const sessionKey = args.slice(0, spaceIdx);
			const message = args.slice(spaceIdx + 1);
			await call('chat.send', {
				sessionKey,
				message,
				idempotencyKey: crypto.randomUUID(),
				deliver: false
			});
		}
	}
];

/**
 * Fuzzy filter commands by query string.
 */
export function filterCommands(query: string): SlashCommand[] {
	if (!query) return commands;
	const lower = query.toLowerCase();
	return commands.filter((cmd) => cmd.name.toLowerCase().includes(lower));
}

/**
 * Parse a slash command from input text.
 * Returns the command and remaining args, or null if not a command.
 */
export function parseCommand(text: string): { command: SlashCommand; args: string } | null {
	if (!text.startsWith('/')) return null;
	const parts = text.slice(1).split(/\s+/);
	const name = parts[0]?.toLowerCase();
	if (!name) return null;
	const command = commands.find((c) => c.name === name);
	if (!command) return null;
	const args = parts.slice(1).join(' ');
	return { command, args };
}
