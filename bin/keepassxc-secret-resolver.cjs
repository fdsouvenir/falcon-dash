#!/usr/bin/env node
/**
 * keepassxc-secret-resolver.cjs
 *
 * Gateway exec provider for reading secrets from the KeePassXC vault.
 *
 * Protocol
 * --------
 * stdin:  JSON object  { "keys": ["path/to/entry", "path/to/entry:UserName", ...] }
 * stdout: JSON object  { "path/to/entry": "password_value", "path/to/entry:UserName": "username_value" }
 * exit 0 on success, exit 1 on fatal error (prints error to stderr).
 *
 * Key format
 * ----------
 * "Group/Entry"               → returns the entry's Password field
 * "Group/Entry:Password"      → same as above (explicit)
 * "Group/Entry:UserName"      → returns the UserName field
 * "Group/Entry:URL"           → returns the URL field
 * "Group/Entry:Notes"         → returns the Notes field
 *
 * Vault config
 * ------------
 * DB:      ~/.openclaw/passwords.kdbx
 * Keyfile: ~/.openclaw/vault.key
 * Auth:    --no-password --key-file
 *
 * Usage (as an openclaw exec provider)
 * -------------------------------------
 *   command: /path/to/bin/keepassxc-secret-resolver.cjs
 */

'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');
const { join } = require('path');
const { homedir } = require('os');

const execFileAsync = promisify(execFile);

const KDBX = join(homedir(), '.openclaw', 'passwords.kdbx');
const KEY_FILE = join(homedir(), '.openclaw', 'vault.key');
const CLI = 'keepassxc-cli';

/**
 * Run keepassxc-cli show --show-protected for an entry.
 * Returns the raw output string.
 */
async function showEntry(entryPath) {
	const args = [
		'show',
		'--no-password',
		'--key-file',
		KEY_FILE,
		'--show-protected',
		KDBX,
		entryPath
	];
	const { stdout } = await execFileAsync(CLI, args, { timeout: 10000, maxBuffer: 1024 * 1024 });
	return stdout;
}

/**
 * Parse `keepassxc-cli show -s` output and extract a named attribute.
 * @param {string} output - raw stdout from keepassxc-cli show
 * @param {string} field  - attribute name: Password, UserName, URL, Notes, Title
 * @returns {string}
 */
function extractField(output, field) {
	const lines = output.split('\n');
	const line = lines.find((l) => l.startsWith(`${field}: `));
	return line ? line.slice(field.length + 2).trim() : '';
}

/**
 * Resolve a single key to its value.
 * Key format: "path/to/entry" or "path/to/entry:FieldName"
 */
async function resolveKey(key) {
	const colonIdx = key.lastIndexOf(':');

	// Heuristic: if the part after the last colon looks like a KeePassXC field name,
	// treat it as a field selector. Otherwise the whole key is the entry path.
	const knownFields = new Set(['Password', 'UserName', 'URL', 'Notes', 'Title', 'Uuid']);
	let entryPath = key;
	let field = 'Password';

	if (colonIdx !== -1) {
		const possibleField = key.slice(colonIdx + 1);
		if (knownFields.has(possibleField)) {
			entryPath = key.slice(0, colonIdx);
			field = possibleField;
		}
	}

	const output = await showEntry(entryPath);
	return extractField(output, field);
}

async function main() {
	let input = '';

	// Read all of stdin
	await new Promise((resolve, reject) => {
		process.stdin.setEncoding('utf8');
		process.stdin.on('data', (chunk) => (input += chunk));
		process.stdin.on('end', resolve);
		process.stdin.on('error', reject);
	});

	let parsed;
	try {
		parsed = JSON.parse(input.trim());
	} catch (err) {
		process.stderr.write(`keepassxc-secret-resolver: invalid JSON input: ${err.message}\n`);
		process.exit(1);
	}

	const keys = parsed.keys;
	if (!Array.isArray(keys)) {
		process.stderr.write('keepassxc-secret-resolver: "keys" must be an array\n');
		process.exit(1);
	}

	const result = {};
	const errors = [];

	// Resolve all keys (cache entries to avoid redundant CLI calls)
	const entryCache = new Map();

	for (const key of keys) {
		try {
			const colonIdx = key.lastIndexOf(':');
			const knownFields = new Set(['Password', 'UserName', 'URL', 'Notes', 'Title', 'Uuid']);
			let entryPath = key;
			let field = 'Password';

			if (colonIdx !== -1) {
				const possibleField = key.slice(colonIdx + 1);
				if (knownFields.has(possibleField)) {
					entryPath = key.slice(0, colonIdx);
					field = possibleField;
				}
			}

			let output;
			if (entryCache.has(entryPath)) {
				output = entryCache.get(entryPath);
			} else {
				output = await showEntry(entryPath);
				entryCache.set(entryPath, output);
			}

			result[key] = extractField(output, field);
		} catch (err) {
			errors.push(`${key}: ${err.message}`);
			result[key] = '';
		}
	}

	process.stdout.write(JSON.stringify(result) + '\n');

	if (errors.length > 0) {
		process.stderr.write(`keepassxc-secret-resolver: ${errors.length} key(s) failed:\n`);
		for (const e of errors) {
			process.stderr.write(`  - ${e}\n`);
		}
		// Exit 0 anyway — partial results are still returned.
		// Change to exit(1) if you want strict all-or-nothing behaviour.
	}
}

main().catch((err) => {
	process.stderr.write(`keepassxc-secret-resolver: fatal: ${err.message}\n`);
	process.exit(1);
});
