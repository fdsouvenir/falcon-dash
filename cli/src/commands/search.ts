import { Command } from 'commander';
import { client } from '../client.js';
import { formatOutput, type OutputFormat } from '../format.js';

function getFormat(cmd: Command): OutputFormat {
	return cmd.optsWithGlobals().format ?? 'table';
}

export function registerSearchCommands(program: Command): void {
	program
		.command('search')
		.argument('<query>', 'Search query')
		.option('--type <type>', 'Filter by type (domain, focus, project, task)')
		.description('Search across all entities')
		.action(async (query, opts, cmd) => {
			try {
				const result = await client.search(query, opts.type);
				console.log(formatOutput(result.results, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});
}
