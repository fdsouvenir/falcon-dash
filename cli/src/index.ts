#!/usr/bin/env node
import { Command } from 'commander';
import { setBaseUrl } from './config.js';
import { registerDomainCommands } from './commands/domain.js';
import { registerFocusCommands } from './commands/focus.js';
import { registerProjectCommands } from './commands/project.js';
import { registerTaskCommands } from './commands/task.js';
import { registerCommentCommands } from './commands/comment.js';
import { registerBlockCommands } from './commands/block.js';
import { registerSearchCommands } from './commands/search.js';
import { registerStatsCommands } from './commands/stats.js';
import { registerContextCommands } from './commands/context.js';

const program = new Command();

program
	.name('ocpm')
	.description('CLI for OpenClaw Project Management')
	.version('0.1.0')
	.option('--url <url>', 'Base URL for Falcon Dash API')
	.option('--format <format>', 'Output format: table, json, markdown', 'table')
	.hook('preAction', (thisCommand) => {
		const opts = thisCommand.opts();
		if (opts.url) setBaseUrl(opts.url);
	});

registerDomainCommands(program);
registerFocusCommands(program);
registerProjectCommands(program);
registerTaskCommands(program);
registerCommentCommands(program);
registerBlockCommands(program);
registerSearchCommands(program);
registerStatsCommands(program);
registerContextCommands(program);

program.parse();
