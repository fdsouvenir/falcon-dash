#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * install-skills.cjs — Copy Falcon Dash skills to ~/.openclaw/skills/
 *
 * Runs as npm postinstall. Copies each skill directory from the package's
 * skills/ folder into the shared OpenClaw skills directory. Safe to run
 * multiple times — overwrites existing files (package is source of truth).
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

	try {
		fs.mkdirSync(SKILLS_DEST, { recursive: true });
	} catch (_err) {
		// Can't create target — skip silently (CI, containers, etc.)
		console.log('[falcon-dash] Skipping skill install: cannot create ' + SKILLS_DEST);
		return;
	}

	const skills = fs.readdirSync(SKILLS_SRC, { withFileTypes: true }).filter((e) => e.isDirectory());

	let installed = 0;
	for (const skill of skills) {
		const src = path.join(SKILLS_SRC, skill.name);
		const dest = path.join(SKILLS_DEST, skill.name);
		try {
			copyDirSync(src, dest);
			installed++;
		} catch (err) {
			console.error(`[falcon-dash] Failed to install skill "${skill.name}":`, err.message);
		}
	}

	if (installed > 0) {
		console.log(`[falcon-dash] Installed ${installed} skill(s) to ${SKILLS_DEST}`);
	}
}

main();
