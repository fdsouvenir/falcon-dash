import { Command } from 'commander';
import { client } from '../client.js';
import { formatOutput, type OutputFormat } from '../format.js';

function getFormat(cmd: Command): OutputFormat {
	return cmd.optsWithGlobals().format ?? 'table';
}

export function registerTaskCommands(program: Command): void {
	const task = program.command('task').description('Manage tasks');

	task
		.command('list')
		.option('--project <id>', 'Filter by project ID')
		.option('--parent-task <id>', 'Filter by parent task ID')
		.option('--status <status>', 'Filter by status')
		.description('List tasks')
		.action(async (opts, cmd) => {
			try {
				const result = await client.listTasks(
					opts.project ? Number(opts.project) : undefined,
					opts.parentTask ? Number(opts.parentTask) : undefined,
					opts.status
				);
				console.log(formatOutput(result.items, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	task
		.command('get')
		.argument('<id>', 'Task ID')
		.description('Get a task by ID')
		.action(async (id, _, cmd) => {
			try {
				const result = await client.getTask(Number(id));
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	task
		.command('create')
		.option('--project <id>', 'Parent project ID')
		.option('--parent-task <id>', 'Parent task ID')
		.requiredOption('--title <title>', 'Task title')
		.option('--description <desc>', 'Task description')
		.option('--status <status>', 'Task status')
		.option('--priority <priority>', 'Task priority')
		.description('Create a new task')
		.action(async (opts, cmd) => {
			try {
				const result = await client.createTask({
					parent_project_id: opts.project ? Number(opts.project) : undefined,
					parent_task_id: opts.parentTask ? Number(opts.parentTask) : undefined,
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

	task
		.command('update')
		.argument('<id>', 'Task ID')
		.option('--title <title>', 'Task title')
		.option('--description <desc>', 'Task description')
		.option('--status <status>', 'Task status')
		.option('--priority <priority>', 'Task priority')
		.description('Update a task')
		.action(async (id, opts, cmd) => {
			try {
				const data: Record<string, string> = {};
				if (opts.title) data.title = opts.title;
				if (opts.description) data.description = opts.description;
				if (opts.status) data.status = opts.status;
				if (opts.priority) data.priority = opts.priority;
				const result = await client.updateTask(Number(id), data);
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	task
		.command('move')
		.argument('<id>', 'Task ID')
		.option('--project <id>', 'Target project ID')
		.option('--parent-task <id>', 'Target parent task ID')
		.description('Move a task')
		.action(async (id, opts, cmd) => {
			try {
				const result = await client.moveTask(Number(id), {
					parent_project_id: opts.project ? Number(opts.project) : undefined,
					parent_task_id: opts.parentTask ? Number(opts.parentTask) : undefined
				});
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	task
		.command('delete')
		.argument('<id>', 'Task ID')
		.description('Delete a task')
		.action(async (id) => {
			try {
				await client.deleteTask(Number(id));
				console.log('Task deleted.');
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});
}
