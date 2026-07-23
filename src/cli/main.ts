import { runAxiCli } from 'axi-sdk-js';
import { CliError, exitCodeFor } from './errors.js';
import { apiGet } from './http.js';
import { commandHelp, nounCommand, workCommand } from './nouns.js';
import { render } from './render.js';

/**
 * `falcon` — AXI for Falcon Dash v3 Work (doc 04). TOON default output,
 * --json escape hatch, stable exit classes, concise help, no-arg orientation.
 */

const TOP_LEVEL_HELP = `falcon — Falcon Dash Work for agents

Usage: falcon <command> [args] [flags]

Commands:
  work     list | get <id> | search <query>
  task     list | get | create | ready | start | wait | resume | submit | accept | complete | cancel | reopen | update
  area     list | get | create | update | archive | restore
  blocker  list | get | create | resolve | invalidate

Output flags (all commands): --json, --fields a,b, --full
Config: FALCON_DASH_URL, FALCON_DASH_TOKEN (or token file under the data dir; FALCON_AGENT_ID selects one)

Run \`falcon <command> --help\` for verb details. No-arg \`falcon\` shows current orientation.`;

/** No-arg orientation: compact, high-value, never a manual (doc 04). */
async function home(): Promise<string> {
	try {
		const actionable = await apiGet('/api/v3/objects/task?active=true&limit=6');
		const items = (actionable.items as Record<string, unknown>[]).map((task) => ({
			id: task.id,
			title: task.title,
			status: task.status,
			actionability: task.actionability,
			...(task.blocker_summary ? { blocked_by: task.blocker_summary } : {})
		}));
		return render({
			open_tasks: actionable.total,
			tasks: items,
			help: [
				'falcon task get <id> — detail with legal next actions',
				'falcon work search <query> — find Work by text',
				'falcon task create --area-id <a1> --title "…" — capture new Work'
			]
		});
	} catch (error) {
		if (error instanceof CliError && error.code === 'unauthorized') {
			return render({
				error: { code: error.code, message: error.message },
				help: ['Mint a token in Falcon Dash Settings → Agent Tokens']
			});
		}
		throw error;
	}
}

await runAxiCli({
	description: 'Falcon Dash Work for agents (v3 AXI)',
	argv: process.argv.slice(2),
	topLevelHelp: TOP_LEVEL_HELP,
	home,
	commands: {
		work: (args) => workCommand(args),
		task: (args) => nounCommand('task')(args),
		area: (args) => nounCommand('area')(args),
		blocker: (args) => nounCommand('blocker')(args)
	},
	getCommandHelp: (command) => {
		if (command === 'work') return 'falcon work list|get <id>|search <query> — cross-type reads';
		if (command === 'task' || command === 'area' || command === 'blocker') {
			return commandHelp(command);
		}
		return null;
	},
	formatError: (error) => {
		if (error instanceof CliError) {
			return {
				output: render({
					error: {
						code: error.code,
						message: error.message,
						...(Object.keys(error.details).length > 0 ? { details: error.details } : {})
					},
					...(error.suggestions.length > 0 ? { help: error.suggestions } : {})
				}),
				exitCode: error.exitCode
			};
		}
		return {
			output: render({
				error: {
					code: 'internal_error',
					message: error instanceof Error ? error.message : String(error)
				}
			}),
			exitCode: exitCodeFor(error)
		};
	}
});
