import { Command } from 'commander';
import { client } from '../client.js';
import { formatOutput, type OutputFormat } from '../format.js';

function getFormat(cmd: Command): OutputFormat {
	return cmd.optsWithGlobals().format ?? 'table';
}

export function registerProjectCommands(program: Command): void {
	const project = program.command('project').description('Manage projects');

	project
		.command('list')
		.option('--focus <id>', 'Filter by focus ID')
		.option('--status <status>', 'Filter by status')
		.description('List projects')
		.action(async (opts, cmd) => {
			try {
				const result = await client.listProjects(
					opts.focus ? Number(opts.focus) : undefined,
					opts.status
				);
				console.log(formatOutput(result.items, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	project
		.command('get')
		.argument('<id>', 'Project ID')
		.description('Get a project by ID')
		.action(async (id, _, cmd) => {
			try {
				const result = await client.getProject(Number(id));
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	project
		.command('create')
		.requiredOption('--focus <id>', 'Focus ID')
		.requiredOption('--title <title>', 'Project title')
		.option('--description <desc>', 'Project description')
		.option('--status <status>', 'Project status')
		.option('--priority <priority>', 'Project priority')
		.description('Create a new project')
		.action(async (opts, cmd) => {
			try {
				const result = await client.createProject({
					focus_id: Number(opts.focus),
					title: opts.title,
					description: opts.description,
					status: opts.status,
					priority: opts.priority
				});
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	project
		.command('update')
		.argument('<id>', 'Project ID')
		.option('--title <title>', 'Project title')
		.option('--description <desc>', 'Project description')
		.option('--status <status>', 'Project status')
		.option('--priority <priority>', 'Project priority')
		.description('Update a project')
		.action(async (id, opts, cmd) => {
			try {
				const data: Record<string, string> = {};
				if (opts.title) data.title = opts.title;
				if (opts.description) data.description = opts.description;
				if (opts.status) data.status = opts.status;
				if (opts.priority) data.priority = opts.priority;
				const result = await client.updateProject(Number(id), data);
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	project
		.command('delete')
		.argument('<id>', 'Project ID')
		.description('Delete a project')
		.action(async (id) => {
			try {
				await client.deleteProject(Number(id));
				console.log('Project deleted.');
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});
}
