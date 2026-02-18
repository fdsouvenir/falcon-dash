import { Command } from 'commander';
import { client } from '../client.js';
import { formatOutput, type OutputFormat } from '../format.js';

function getFormat(cmd: Command): OutputFormat {
	return cmd.optsWithGlobals().format ?? 'table';
}

export function registerDomainCommands(program: Command): void {
	const domain = program.command('domain').description('Manage domains');

	domain
		.command('list')
		.description('List all domains')
		.action(async (_, cmd) => {
			try {
				const result = await client.listDomains();
				console.log(formatOutput(result.items, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	domain
		.command('get')
		.argument('<id>', 'Domain ID')
		.description('Get a domain by ID')
		.action(async (id, _, cmd) => {
			try {
				const result = await client.getDomain(Number(id));
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	domain
		.command('create')
		.requiredOption('--name <name>', 'Domain name')
		.option('--description <desc>', 'Domain description')
		.description('Create a new domain')
		.action(async (opts, cmd) => {
			try {
				const result = await client.createDomain({
					name: opts.name,
					description: opts.description
				});
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	domain
		.command('update')
		.argument('<id>', 'Domain ID')
		.option('--name <name>', 'Domain name')
		.option('--description <desc>', 'Domain description')
		.description('Update a domain')
		.action(async (id, opts, cmd) => {
			try {
				const data: Record<string, string> = {};
				if (opts.name) data.name = opts.name;
				if (opts.description) data.description = opts.description;
				const result = await client.updateDomain(Number(id), data);
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	domain
		.command('delete')
		.argument('<id>', 'Domain ID')
		.description('Delete a domain')
		.action(async (id) => {
			try {
				await client.deleteDomain(Number(id));
				console.log('Domain deleted.');
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});
}
