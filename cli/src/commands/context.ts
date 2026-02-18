import { Command } from 'commander';
import { client } from '../client.js';
import { formatOutput, type OutputFormat } from '../format.js';

function getFormat(cmd: Command): OutputFormat {
	return cmd.optsWithGlobals().format ?? 'table';
}

export function registerContextCommands(program: Command): void {
	const context = program.command('context').description('Project context generation');

	context
		.command('show')
		.description('Show dashboard context')
		.action(async (_, cmd) => {
			try {
				const result = await client.getDashboardContext();
				const format = getFormat(cmd);
				if (format === 'json') {
					console.log(formatOutput(result, format));
				} else {
					console.log(result.markdown);
				}
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	context
		.command('domain')
		.argument('<id>', 'Domain ID')
		.description('Show domain context')
		.action(async (id, _, cmd) => {
			try {
				const result = await client.getDomainContext(Number(id));
				const format = getFormat(cmd);
				if (format === 'json') {
					console.log(formatOutput(result, format));
				} else {
					console.log(result.markdown);
				}
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	context
		.command('project')
		.argument('<id>', 'Project ID')
		.description('Show project context')
		.action(async (id, _, cmd) => {
			try {
				const result = await client.getProjectContext(Number(id));
				const format = getFormat(cmd);
				if (format === 'json') {
					console.log(formatOutput(result, format));
				} else {
					console.log(result.markdown);
				}
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	context
		.command('generate')
		.description('Generate context files')
		.action(async (_, cmd) => {
			try {
				const result = await client.generateContext();
				const format = getFormat(cmd);
				if (format === 'json') {
					console.log(formatOutput(result, format));
				} else {
					console.log(`Generated ${result.filesWritten} context file(s).`);
				}
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});
}
