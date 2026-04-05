#!/usr/bin/env node

import { readdir, readFile, stat, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const skillsRoot = path.join(root, 'skills');

function extractFrontmatter(source) {
	const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
	return match ? match[1] : null;
}

function getFrontmatterValue(frontmatter, key) {
	const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
	return match ? match[1].trim() : null;
}

function collectMarkdownLinks(source) {
	const links = [];
	const regex = /\[[^\]]+\]\(([^)]+)\)/g;
	let match;
	while ((match = regex.exec(source)) !== null) {
		links.push(match[1]);
	}
	return links;
}

async function pathExists(targetPath) {
	try {
		await access(targetPath);
		return true;
	} catch {
		return false;
	}
}

async function validateSkill(skillDirName) {
	const skillDir = path.join(skillsRoot, skillDirName);
	const skillFile = path.join(skillDir, 'SKILL.md');
	const failures = [];

	if (!(await pathExists(skillFile))) {
		failures.push(`${skillDirName}: missing SKILL.md`);
		return failures;
	}

	const skillSource = await readFile(skillFile, 'utf8');
	const frontmatter = extractFrontmatter(skillSource);

	if (!frontmatter) {
		failures.push(`${skillDirName}: SKILL.md missing YAML frontmatter`);
	} else {
		const nameValue = getFrontmatterValue(frontmatter, 'name');
		const descriptionValue = getFrontmatterValue(frontmatter, 'description');

		if (!nameValue) failures.push(`${skillDirName}: SKILL.md missing frontmatter field "name"`);
		if (!descriptionValue) {
			failures.push(`${skillDirName}: SKILL.md missing frontmatter field "description"`);
		}
	}

	const childEntries = await readdir(skillDir);
	if (childEntries.includes('agents')) {
		const openaiYaml = path.join(skillDir, 'agents', 'openai.yaml');
		if (!(await pathExists(openaiYaml))) {
			failures.push(`${skillDirName}: agents/ exists but agents/openai.yaml is missing`);
		}
	}

	const markdownFiles = [];
	for (const entry of childEntries) {
		const fullPath = path.join(skillDir, entry);
		const entryStat = await stat(fullPath);
		if (entryStat.isFile() && entry.endsWith('.md')) {
			markdownFiles.push(fullPath);
		}
		if (entryStat.isDirectory() && entry === 'references') {
			const refs = await readdir(fullPath);
			for (const ref of refs) {
				if (ref.endsWith('.md')) markdownFiles.push(path.join(fullPath, ref));
			}
		}
	}

	for (const markdownFile of markdownFiles) {
		const source = await readFile(markdownFile, 'utf8');
		const links = collectMarkdownLinks(source);
		for (const link of links) {
			if (
				link.startsWith('http://') ||
				link.startsWith('https://') ||
				link.startsWith('#') ||
				link.startsWith('mailto:')
			) {
				continue;
			}
			const cleanLink = link.split('#')[0];
			if (!cleanLink) continue;
			const resolved = path.resolve(path.dirname(markdownFile), cleanLink);
			if (!(await pathExists(resolved))) {
				failures.push(
					`${skillDirName}: broken relative link "${link}" in ${path.relative(root, markdownFile)}`
				);
			}
		}
	}

	return failures;
}

const skillEntries = await readdir(skillsRoot, { withFileTypes: true });
const skillDirs = skillEntries
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();

const failures = [];
for (const skillDirName of skillDirs) {
	failures.push(...(await validateSkill(skillDirName)));
}

if (failures.length > 0) {
	console.error('Skill validation failed:');
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log(`Skill validation passed (${skillDirs.length} skill directories).`);
