#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import process from 'node:process';

function runGit(args) {
	return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function parseArgs(argv) {
	const options = {};

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--base') options.base = argv[i + 1];
		if (arg === '--head') options.head = argv[i + 1];
	}

	return options;
}

function isZeroSha(value) {
	return typeof value === 'string' && /^0+$/.test(value);
}

function getChangedPaths(base, head) {
	if (base && head && !isZeroSha(base)) {
		const output = runGit(['diff', '--name-only', '--diff-filter=ACMRTUXB', base, head]);
		return output ? output.split('\n').filter(Boolean) : [];
	}

	const output = runGit(['status', '--porcelain']);
	if (!output) return [];

	return output
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const trimmed = line.trim();
			if (trimmed.includes(' -> ')) return trimmed.split(' -> ').at(-1) ?? trimmed;
			return trimmed.slice(3);
		});
}

function matchesPrefix(path, prefix) {
	return path === prefix || path.startsWith(`${prefix}/`);
}

function touchesAny(paths, patterns) {
	return paths.some((path) =>
		patterns.some((pattern) => {
			if (pattern.endsWith('/')) return path.startsWith(pattern);
			return path === pattern;
		})
	);
}

function docTouched(changedDocs, docMatchers) {
	return changedDocs.some((path) =>
		docMatchers.some((matcher) => {
			if (matcher.endsWith('/')) return path.startsWith(matcher);
			return path === matcher;
		})
	);
}

const ignoredMatchers = [
	'docs/',
	'skills/',
	'e2e/',
	'scripts/',
	'.github/',
	'package.json',
	'package-lock.json',
	'AGENTS.md'
];

const rules = [
	{
		name: 'frontend surfaces and shell behavior',
		matchers: ['src/routes/', 'src/lib/components/', 'src/app.css', 'src/lib/theme/'],
		requiredDocs: [
			'docs/FRONTEND.md',
			'docs/QUALITY.md',
			'docs/Technical/components.md',
			'docs/Technical/architecture.md',
			'docs/End User/'
		]
	},
	{
		name: 'stores, realtime state, and client wiring',
		matchers: [
			'src/lib/stores/',
			'src/hooks.client.ts',
			'src/lib/gateway-api.ts',
			'src/lib/canvas/'
		],
		requiredDocs: [
			'docs/RELIABILITY.md',
			'docs/QUALITY.md',
			'docs/Technical/stores.md',
			'docs/Technical/architecture.md',
			'docs/Technical/gateway-protocol.md'
		]
	},
	{
		name: 'project management flows',
		matchers: [
			'src/lib/server/pm/',
			'src/routes/api/pm/',
			'src/lib/components/pm/',
			'src/lib/stores/pm-',
			'src/routes/projects/'
		],
		requiredDocs: [
			'docs/Technical/pm-pipeline.md',
			'docs/QUALITY.md',
			'docs/RELIABILITY.md',
			'docs/End User/projects.md'
		]
	},
	{
		name: 'agents, channels, canvas, and gateway integration',
		matchers: [
			'src/lib/server/agents/',
			'src/routes/api/agents/',
			'src/lib/channels/',
			'src/routes/channels/',
			'src/routes/agents/',
			'src/routes/apps/',
			'src/routes/api/ops/',
			'src/lib/server/terminal-server.ts'
		],
		requiredDocs: [
			'docs/Technical/architecture.md',
			'docs/Technical/gateway-protocol.md',
			'docs/Technical/gateway-plugin.md',
			'docs/QUALITY.md',
			'docs/RELIABILITY.md',
			'docs/End User/agents.md',
			'docs/End User/channels.md',
			'docs/End User/apps.md'
		]
	}
];

const { base, head } = parseArgs(process.argv.slice(2));
const changedPaths = getChangedPaths(base, head);
const highSignalPaths = changedPaths.filter(
	(path) =>
		!ignoredMatchers.some((matcher) => {
			if (matcher.endsWith('/')) return path.startsWith(matcher);
			return path === matcher;
		})
);

if (changedPaths.length === 0) {
	console.log('Doc freshness check skipped: no changed paths detected.');
	process.exit(0);
}

if (highSignalPaths.length === 0) {
	console.log(
		'Doc freshness check skipped: only docs, skills, scripts, test, or repo-meta paths changed.'
	);
	process.exit(0);
}

const changedDocs = changedPaths.filter((path) => matchesPrefix(path, 'docs'));
const violations = [];

for (const rule of rules) {
	if (!touchesAny(highSignalPaths, rule.matchers)) continue;
	if (docTouched(changedDocs, rule.requiredDocs)) continue;

	const triggeringPaths = highSignalPaths.filter((path) =>
		rule.matchers.some((matcher) => {
			if (matcher.endsWith('/')) return path.startsWith(matcher);
			return path === matcher || path.startsWith(matcher);
		})
	);

	violations.push({
		name: rule.name,
		triggeringPaths,
		requiredDocs: rule.requiredDocs
	});
}

if (violations.length > 0) {
	console.error('Doc freshness check failed.');
	console.error(
		'High-signal code paths changed without touching a matching docs file. Update one of the suggested docs or narrow the change.'
	);
	console.error('');

	for (const violation of violations) {
		console.error(`Rule: ${violation.name}`);
		console.error(`Changed paths: ${violation.triggeringPaths.join(', ')}`);
		console.error(`Suggested docs: ${violation.requiredDocs.join(', ')}`);
		console.error('');
	}

	process.exit(1);
}

console.log(
	`Doc freshness check passed (${highSignalPaths.length} high-signal paths scanned, ${changedPaths.length} total changed paths).`
);
