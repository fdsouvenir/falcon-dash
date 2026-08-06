#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * install-skills.cjs — Copy Falcon Dash skills to ~/.openclaw/skills/
 *
 * Runs as npm postinstall. Copies Falcon Dash's explicitly allowlisted runtime
 * skills into the shared OpenClaw skills directory. Repo-development skills
 * and generic skill names must never be shipped into an operator's agent.
 *
 * Skips gracefully if the target directory can't be created (e.g., running
 * in CI or a container without a home directory).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SKILLS_SRC = path.join(__dirname, '..', 'skills');
const SKILLS_DEST = path.join(os.homedir(), '.openclaw', 'skills');
const SKILLS_MANIFEST = path.join(SKILLS_SRC, 'manifest.json');

function copyDirSync(src, dest) {
	fs.mkdirSync(dest, { recursive: true });
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			copyDirSync(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

function main() {
	if (!fs.existsSync(SKILLS_SRC)) {
		// No skills directory in package — nothing to do
		return;
	}
	const { runtimeSkills } = JSON.parse(fs.readFileSync(SKILLS_MANIFEST, 'utf8'));
	if (
		!Array.isArray(runtimeSkills) ||
		runtimeSkills.length === 0 ||
		new Set(runtimeSkills).size !== runtimeSkills.length ||
		runtimeSkills.some(
			(skillName) =>
				typeof skillName !== 'string' || !/^falcon-dash(?:-[a-z0-9]+)*$/.test(skillName)
		)
	) {
		throw new Error('skills/manifest.json must declare unique, namespaced runtimeSkills');
	}

	try {
		fs.mkdirSync(SKILLS_DEST, { recursive: true });
	} catch {
		// Can't create target — skip silently (CI, containers, etc.)
		console.log('[falcon-dash] Skipping skill install: cannot create ' + SKILLS_DEST);
		return;
	}

	let installed = 0;
	for (const skillName of runtimeSkills) {
		const src = path.join(SKILLS_SRC, skillName);
		const dest = path.join(SKILLS_DEST, skillName);
		if (!fs.existsSync(path.join(src, 'SKILL.md'))) {
			console.error(`[falcon-dash] Packaged runtime skill is missing: ${skillName}`);
			continue;
		}
		try {
			copyDirSync(src, dest);
			installed++;
		} catch (err) {
			console.error(`[falcon-dash] Failed to install skill "${skillName}":`, err.message);
		}
	}

	if (installed > 0) {
		console.log(`[falcon-dash] Installed ${installed} skill(s) to ${SKILLS_DEST}`);
	}
}

main();
