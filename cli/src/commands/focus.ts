import { Command } from 'commander';
import { client } from '../client.js';
import { formatOutput, type OutputFormat } from '../format.js';

function getFormat(cmd: Command): OutputFormat {
	return cmd.optsWithGlobals().format ?? 'table';
}

export function registerFocusCommands(program: Command): void {
	const focus = program.command('focus').description('Manage focuses');

	focus
		.command('list')
		.option('--domain <id>', 'Filter by domain ID')
		.description('List focuses')
		.action(async (opts, cmd) => {
			try {
				const result = await client.listFocuses(opts.domain ? Number(opts.domain) : undefined);
				console.log(formatOutput(result.items, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	focus
		.command('get')
		.argument('<id>', 'Focus ID')
		.description('Get a focus by ID')
		.action(async (id, _, cmd) => {
			try {
				const result = await client.getFocus(Number(id));
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	focus
		.command('create')
		.requiredOption('--domain <id>', 'Domain ID')
		.requiredOption('--name <name>', 'Focus name')
		.option('--description <desc>', 'Focus description')
		.description('Create a new focus')
		.action(async (opts, cmd) => {
			try {
				const result = await client.createFocus({
					domain_id: Number(opts.domain),
					name: opts.name,
					description: opts.description
				});
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	focus
		.command('update')
		.argument('<id>', 'Focus ID')
		.option('--name <name>', 'Focus name')
		.option('--description <desc>', 'Focus description')
		.description('Update a focus')
		.action(async (id, opts, cmd) => {
			try {
				const data: Record<string, string> = {};
				if (opts.name) data.name = opts.name;
				if (opts.description) data.description = opts.description;
				const result = await client.updateFocus(Number(id), data);
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	focus
		.command('delete')
		.argument('<id>', 'Focus ID')
		.description('Delete a focus')
		.action(async (id) => {
			try {
				await client.deleteFocus(Number(id));
				console.log('Focus deleted.');
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	focus
		.command('move')
		.argument('<id>', 'Focus ID')
		.requiredOption('--domain <id>', 'Target domain ID')
		.description('Move a focus to another domain')
		.action(async (id, opts, cmd) => {
			try {
				const result = await client.moveFocus(Number(id), Number(opts.domain));
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});
}
