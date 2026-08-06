#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import process from 'node:process';

function runGit(args) {
	return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function parseArgs(argv) {
	const options = {};
	for (let i = 0; i < argv.length; i += 1) {
		if (argv[i] === '--base') options.base = argv[i + 1];
		if (argv[i] === '--head') options.head = argv[i + 1];
	}
	return options;
}

function getChangedPaths(base, head) {
	if (base && head && !/^0+$/.test(base)) {
		const output = runGit(['diff', '--name-only', '--diff-filter=ACMRTUXB', base, head]);
		return output ? output.split('\n').filter(Boolean) : [];
	}
	const output = execFileSync(
		'git',
		['status', '--porcelain=v1', '--untracked-files=all', '--no-renames', '-z'],
		{ encoding: 'utf8' }
	);
	if (!output) return [];
	return output
		.split('\0')
		.filter(Boolean)
		.map((line) => line.slice(3));
}

function matches(path, matcher) {
	return matcher.endsWith('/')
		? path.startsWith(matcher)
		: path === matcher || path.startsWith(`${matcher}/`);
}

function touches(paths, matchers) {
	return paths.some((path) => matchers.some((matcher) => matches(path, matcher)));
}

const ignoredMatchers = ['docs/', 'skills/', 'e2e/', 'scripts/', 'package-lock.json'];

// Every required group must have at least one matching changed document. Keep rules narrow: touching
// an unrelated end-user guide must never satisfy a Work, Vault, gateway, or deployment change.
const rules = [
	{
		name: 'shared frontend and shell behavior',
		matchers: [
			'src/routes/+layout.svelte',
			'src/lib/components/AppShell.svelte',
			'src/lib/components/mobile/',
			'src/lib/components/ui/',
			'src/app.css'
		],
		requiredDocGroups: [['docs/FRONTEND.md', 'docs/DESIGN.md'], ['docs/Technical/components.md']]
	},
	{
		name: 'browser stores and realtime reliability',
		matchers: ['src/lib/stores/', 'src/lib/work3/live.ts', 'src/hooks.client.ts'],
		requiredDocGroups: [['docs/Technical/stores.md'], ['docs/RELIABILITY.md']]
	},
	{
		name: 'server gateway transport and proxy',
		matchers: [
			'src/lib/server/gateway-client.ts',
			'src/lib/server/gateway-config.ts',
			'src/lib/server/server-device-identity.ts',
			'src/routes/api/gateway/',
			'src/entry.js'
		],
		requiredDocGroups: [
			['docs/Technical/gateway-protocol.md'],
			['docs/Technical/architecture.md', 'docs/Technical/deployment.md']
		]
	},
	{
		name: 'gateway plugin and agent context',
		matchers: ['gateway-plugin/', 'openclaw.plugin.json'],
		requiredDocGroups: [
			['docs/Technical/gateway-plugin.md'],
			['docs/Technical/work-management.md', 'docs/ROADMAP.md']
		]
	},
	{
		name: 'Work domain and agent interface',
		matchers: [
			'src/lib/server/work3/',
			'src/lib/work3/',
			'src/lib/work3-shared/',
			'src/routes/api/v3/',
			'src/routes/api/work3/',
			'bin/falcon.js'
		],
		requiredDocGroups: [['docs/Technical/work-management.md']]
	},
	{
		name: 'Work user interface',
		matchers: ['src/routes/work/', 'src/lib/components/work/'],
		requiredDocGroups: [
			['docs/End User/work.md'],
			['docs/FRONTEND.md', 'docs/Technical/components.md']
		]
	},
	{
		name: 'built-in vault and SecretRefs',
		matchers: [
			'src/lib/server/vault/',
			'src/routes/api/vault/',
			'src/lib/components/vault/',
			'src/lib/stores/vault.ts',
			'bin/keepassxc-secret-resolver.cjs'
		],
		requiredDocGroups: [['docs/End User/passwords.md'], ['docs/secretrefs.md']]
	},
	{
		name: 'channels',
		matchers: ['src/routes/channels/', 'src/lib/channels/', 'src/lib/stores/channel-readiness.ts'],
		requiredDocGroups: [['docs/End User/channels.md']]
	},
	{
		name: 'agents',
		matchers: ['src/routes/agents/', 'src/routes/api/agents/', 'src/lib/server/agents/'],
		requiredDocGroups: [['docs/End User/agents.md']]
	},
	{
		name: 'documents',
		matchers: [
			'src/routes/documents/',
			'src/routes/api/files/',
			'src/lib/stores/files.ts',
			'src/lib/components/DocumentBrowser.svelte',
			'src/lib/components/mobile/MobileDocumentBrowser.svelte'
		],
		requiredDocGroups: [['docs/End User/documents.md']]
	},
	{
		name: 'jobs and OpenClaw cron',
		matchers: [
			'src/routes/jobs/',
			'src/lib/stores/cron.ts',
			'src/lib/components/CronJobList.svelte',
			'src/lib/components/CronJobForm.svelte',
			'src/lib/components/mobile/MobileCronJobList.svelte'
		],
		requiredDocGroups: [['docs/End User/jobs.md']]
	},
	{
		name: 'heartbeat',
		matchers: [
			'src/routes/heartbeat/',
			'src/lib/stores/heartbeat.ts',
			'src/lib/components/HeartbeatPanel.svelte',
			'src/lib/components/HeartbeatHistory.svelte'
		],
		requiredDocGroups: [['docs/End User/heartbeat.md']]
	},
	{
		name: 'operations observer',
		matchers: [
			'src/routes/ops/',
			'src/routes/api/ops/',
			'src/lib/stores/ops.ts',
			'src/lib/components/ops/'
		],
		requiredDocGroups: [['docs/End User/operations.md']]
	},
	{
		name: 'canvas apps',
		matchers: [
			'src/routes/apps/',
			'src/lib/canvas/',
			'src/lib/stores/canvas.ts',
			'src/lib/components/canvas/'
		],
		requiredDocGroups: [['docs/End User/apps.md'], ['docs/Technical/gateway-plugin.md']]
	},
	{
		name: 'OpenClaw secret providers',
		matchers: ['src/routes/secrets/', 'src/lib/stores/secrets.ts'],
		requiredDocGroups: [['docs/End User/secrets.md'], ['docs/secretrefs.md']]
	},
	{
		name: 'skills',
		matchers: ['src/routes/skills/', 'src/lib/components/settings/SkillsTab.svelte'],
		requiredDocGroups: [['docs/End User/skills.md']]
	},
	{
		name: 'execution approvals',
		matchers: [
			'src/routes/approvals/',
			'src/lib/stores/exec-approvals.ts',
			'src/lib/components/settings/ExecApprovals.svelte'
		],
		requiredDocGroups: [['docs/End User/exec-approvals.md']]
	},
	{
		name: 'settings and administrative surfaces',
		matchers: [
			'src/routes/settings/',
			'src/lib/components/settings/',
			'src/lib/components/mobile/MobileSettingsPage.svelte',
			'src/lib/components/mobile/MobileSettingsHome.svelte',
			'src/lib/components/mobile/settings/'
		],
		requiredDocGroups: [['docs/End User/settings.md']]
	},
	{
		name: 'package and runtime deployment',
		matchers: ['package.json', 'bin/falcon-dash.js', 'src/hooks.server.ts', '.github/workflows/'],
		requiredDocGroups: [['docs/Technical/deployment.md']]
	}
];

const { base, head } = parseArgs(process.argv.slice(2));
const changedPaths = getChangedPaths(base, head);
if (changedPaths.length === 0) {
	console.log('Doc freshness check skipped: no changed paths detected.');
	process.exit(0);
}

const highSignalPaths = changedPaths.filter(
	(path) => !ignoredMatchers.some((matcher) => matches(path, matcher)) && path !== 'AGENTS.md'
);
if (highSignalPaths.length === 0) {
	console.log('Doc freshness check skipped: no high-signal implementation paths changed.');
	process.exit(0);
}

const changedDocs = changedPaths.filter((path) => matches(path, 'docs/'));
const violations = [];

for (const rule of rules) {
	if (!touches(highSignalPaths, rule.matchers)) continue;
	const missingGroups = rule.requiredDocGroups.filter((group) => !touches(changedDocs, group));
	if (missingGroups.length === 0) continue;
	violations.push({
		name: rule.name,
		triggeringPaths: highSignalPaths.filter((path) =>
			rule.matchers.some((matcher) => matches(path, matcher))
		),
		missingGroups
	});
}

if (violations.length > 0) {
	console.error('Doc freshness check failed.');
	console.error('High-signal code changed without every owning documentation group.');
	console.error('');
	for (const violation of violations) {
		console.error(`Rule: ${violation.name}`);
		console.error(`Changed paths: ${violation.triggeringPaths.join(', ')}`);
		for (const group of violation.missingGroups) {
			console.error(`Update at least one of: ${group.join(', ')}`);
		}
		console.error('');
	}
	process.exit(1);
}

console.log(
	`Doc freshness check passed (${highSignalPaths.length} high-signal paths scanned, ${changedPaths.length} total changed paths).`
);
