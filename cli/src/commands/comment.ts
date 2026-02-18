import { Command } from 'commander';
import { client } from '../client.js';
import { formatOutput, type OutputFormat } from '../format.js';

function getFormat(cmd: Command): OutputFormat {
	return cmd.optsWithGlobals().format ?? 'table';
}

export function registerCommentCommands(program: Command): void {
	const comment = program.command('comment').description('Manage comments');

	comment
		.command('list')
		.option('--target-type <type>', 'Target type (project, task)')
		.option('--target-id <id>', 'Target ID')
		.description('List comments')
		.action(async (opts, cmd) => {
			try {
				const result = await client.listComments(
					opts.targetType,
					opts.targetId ? Number(opts.targetId) : undefined
				);
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	comment
		.command('add')
		.requiredOption('--target-type <type>', 'Target type (project, task)')
		.requiredOption('--target-id <id>', 'Target ID')
		.requiredOption('--body <body>', 'Comment body')
		.option('--author <author>', 'Comment author', 'cli')
		.description('Add a comment')
		.action(async (opts, cmd) => {
			try {
				const result = await client.createComment({
					target_type: opts.targetType,
					target_id: Number(opts.targetId),
					author: opts.author,
					body: opts.body
				});
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	comment
		.command('update')
		.argument('<id>', 'Comment ID')
		.requiredOption('--body <body>', 'New comment body')
		.description('Update a comment')
		.action(async (id, opts, cmd) => {
			try {
				const result = await client.updateComment(Number(id), { body: opts.body });
				console.log(formatOutput(result, getFormat(cmd)));
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});

	comment
		.command('delete')
		.argument('<id>', 'Comment ID')
		.description('Delete a comment')
		.action(async (id) => {
			try {
				await client.deleteComment(Number(id));
				console.log('Comment deleted.');
			} catch (err) {
				console.error((err as Error).message);
				process.exit(1);
			}
		});
}
