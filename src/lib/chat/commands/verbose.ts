import { registerCommand } from './registry';

const STORAGE_KEY = 'falcon-dash-verbose';

function isVerbose(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

function setVerbose(value: boolean): void {
	try {
		localStorage.setItem(STORAGE_KEY, String(value));
	} catch {
		// Ignore storage errors
	}
}

registerCommand({
	name: 'verbose',
	description: 'Toggle verbose mode (on/off)',
	usage: '/verbose [on|off]',
	execute(args, context) {
		const arg = args.trim().toLowerCase();
		let enabled: boolean;
		if (arg === 'on') {
			enabled = true;
		} else if (arg === 'off') {
			enabled = false;
		} else if (!arg) {
			enabled = !isVerbose();
		} else {
			context.insertLocalMessage(context.sessionKey, 'system', 'Usage: `/verbose [on|off]`');
			return;
		}
		setVerbose(enabled);
		context.insertLocalMessage(
			context.sessionKey,
			'system',
			`Verbose mode **${enabled ? 'enabled' : 'disabled'}**.`
		);
	}
});
