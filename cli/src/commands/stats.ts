import { Command } from 'commander';
import { client } from '../client.js';
import { formatOutput, type OutputFormat } from '../format.js';

function getFormat(cmd: Command): OutputFormat {
	return cmd.optsWithGlobals().format ?? 'table';
}

export function registerStatsCommands(program: Command): void {
	program
		.command('stats')
		.description('Show project management statistics')
		.action(async (_, cmd) => {
			try {
				const result = await client.getStats();
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});
}
