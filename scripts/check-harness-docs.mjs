#!/usr/bin/env node

import { access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const requiredPaths = [
	'AGENTS.md',
	'docs/HARNESS.md',
	'docs/FRONTEND.md',
	'docs/QUALITY.md',
	'docs/RELIABILITY.md',
	'docs/PLANS.md',
	'docs/PURPOSE.md',
	'docs/Technical/architecture.md',
	'docs/Technical/components.md',
	'docs/Technical/stores.md',
	'skills/falcon-dash/SKILL.md',
	'skills/falcon-dash-harness/SKILL.md'
];

const missing = [];

for (const relPath of requiredPaths) {
	try {
		await access(path.join(root, relPath));
	} catch {
		missing.push(relPath);
	}
}

if (missing.length > 0) {
	console.error('Missing required harness files:');
	for (const relPath of missing) {
		console.error(`- ${relPath}`);
	}
	process.exit(1);
}

console.log(`Harness docs check passed (${requiredPaths.length} paths).`);
