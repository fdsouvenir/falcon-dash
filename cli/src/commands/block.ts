import { Command } from 'commander';
import { client } from '../client.js';
import { formatOutput, type OutputFormat } from '../format.js';

function getFormat(cmd: Command): OutputFormat {
	return cmd.optsWithGlobals().format ?? 'table';
}

export function registerBlockCommands(program: Command): void {
	const block = program.command('block').description('Manage task blocks');

	block
		.command('list')
		.requiredOption('--task <id>', 'Task ID')
		.description('List blocks for a task')
		.action(async (opts, cmd) => {
			try {
				const result = await client.listBlocks(Number(opts.task));
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	block
		.command('add')
		.requiredOption('--blocker <id>', 'Blocker task ID')
		.requiredOption('--blocked <id>', 'Blocked task ID')
		.description('Add a block relationship')
		.action(async (opts, cmd) => {
			try {
				const result = await client.createBlock(Number(opts.blocker), Number(opts.blocked));
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	block
		.command('remove')
		.requiredOption('--blocker <id>', 'Blocker task ID')
		.requiredOption('--blocked <id>', 'Blocked task ID')
		.description('Remove a block relationship')
		.action(async (opts) => {
			try {
				await client.deleteBlock(Number(opts.blocker), Number(opts.blocked));
				console.log('Block removed.');
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});
}
