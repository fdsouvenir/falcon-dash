import type { GatewayClient } from '$lib/gateway/client';

export interface CommandContext {
	sessionKey: string;
	sendMessage: (content: string) => void;
	abortRun: () => void;
	updateSession: (key: string, patch: Record<string, unknown>) => void;
	injectMessage: (sessionKey: string, role: string, content: string) => void;
	gateway: GatewayClient;
}

export interface SlashCommand {
	name: string;
	description: string;
	usage?: string;
	execute: (args: string, context: CommandContext) => void | Promise<void>;
}

export const commands: SlashCommand[] = [];

export function registerCommand(command: SlashCommand): void {
	commands.push(command);
}

export function findCommands(filter: string): SlashCommand[] {
	const lower = filter.toLowerCase();
	return commands.filter((cmd) => cmd.name.toLowerCase().includes(lower));
}
