#!/usr/bin/env node

// node_modules/axi-sdk-js/dist/cli.js
import { basename as basename2 } from 'node:path';

// node_modules/axi-sdk-js/dist/errors.js
var AxiError = class extends Error {
	code;
	suggestions;
	constructor(message, code, suggestions = []) {
		super(message);
		this.code = code;
		this.suggestions = suggestions;
		this.name = 'AxiError';
	}
};
function exitCodeForError(error) {
	if (error instanceof AxiError && error.code === 'VALIDATION_ERROR') {
		return 2;
	}
	return 1;
}

// node_modules/axi-sdk-js/dist/output.js
import { homedir } from 'node:os';

// node_modules/axi-sdk-js/node_modules/@toon-format/toon/dist/index.mjs
var NULL_LITERAL = 'null';
var DELIMITERS = {
	comma: ',',
	tab: '	',
	pipe: '|'
};
var DEFAULT_DELIMITER = DELIMITERS.comma;
function escapeString(value) {
	return value
		.replace(/\\/g, `\\\\`)
		.replace(/"/g, `\\"`)
		.replace(/\n/g, `\\n`)
		.replace(/\r/g, `\\r`)
		.replace(/\t/g, `\\t`)
		.replace(/[\u0000-\u001F]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
function isBooleanOrNullLiteral(token) {
	return token === 'true' || token === 'false' || token === 'null';
}
function setOwnProperty(target, key, value) {
	if (key === '__proto__') {
		Object.defineProperty(target, key, {
			value,
			enumerable: true,
			writable: true,
			configurable: true
		});
		return;
	}
	target[key] = value;
}
function normalizeValue(value) {
	if (value === null) return null;
	if (
		typeof value === 'object' &&
		value !== null &&
		'toJSON' in value &&
		typeof value.toJSON === 'function'
	) {
		const next = value.toJSON();
		if (next !== value) return normalizeValue(next);
	}
	if (typeof value === 'string' || typeof value === 'boolean') return value;
	if (typeof value === 'number') {
		if (Object.is(value, -0)) return 0;
		if (!Number.isFinite(value)) return null;
		return value;
	}
	if (typeof value === 'bigint') {
		if (value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER) return Number(value);
		return value.toString();
	}
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map(normalizeValue);
	if (value instanceof Set) return Array.from(value).map(normalizeValue);
	if (value instanceof Map)
		return Object.fromEntries(Array.from(value, ([k, v]) => [String(k), normalizeValue(v)]));
	if (isPlainObject(value)) {
		const encodedValues = {};
		for (const key in value)
			if (Object.hasOwn(value, key)) setOwnProperty(encodedValues, key, normalizeValue(value[key]));
		return encodedValues;
	}
	return null;
}
function isJsonPrimitive(value) {
	return (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	);
}
function isJsonArray(value) {
	return Array.isArray(value);
}
function isJsonObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isEmptyObject(value) {
	return Object.keys(value).length === 0;
}
function isPlainObject(value) {
	if (value === null || typeof value !== 'object') return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === null || prototype === Object.prototype;
}
function isArrayOfPrimitives(value) {
	return value.length === 0 || value.every((item) => isJsonPrimitive(item));
}
function isArrayOfArrays(value) {
	return value.length === 0 || value.every((item) => isJsonArray(item));
}
function isArrayOfObjects(value) {
	return value.length === 0 || value.every((item) => isJsonObject(item));
}
var NUMERIC_LIKE_PATTERN = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i;
var LEADING_ZERO_PATTERN = /^0\d+$/;
function isValidUnquotedKey(key) {
	return /^[A-Z_][\w.]*$/i.test(key);
}
function isIdentifierSegment(key) {
	return /^[A-Z_]\w*$/i.test(key);
}
function isSafeUnquoted(value, delimiter = DEFAULT_DELIMITER) {
	if (!value) return false;
	if (value !== value.trim()) return false;
	if (isBooleanOrNullLiteral(value) || isNumericLike(value)) return false;
	if (value.includes(':')) return false;
	if (value.includes('"') || value.includes('\\')) return false;
	if (/[[\]{}]/.test(value)) return false;
	if (/[\u0000-\u001F]/.test(value)) return false;
	if (value.includes(delimiter)) return false;
	if (value.startsWith('-')) return false;
	return true;
}
function isNumericLike(value) {
	return NUMERIC_LIKE_PATTERN.test(value) || LEADING_ZERO_PATTERN.test(value);
}
function tryFoldKeyChain(key, value, siblings, options, rootLiteralKeys, pathPrefix, flattenDepth) {
	if (options.keyFolding !== 'safe') return;
	if (!isJsonObject(value)) return;
	const { segments, tail, leafValue } = collectSingleKeyChain(
		key,
		value,
		flattenDepth ?? options.flattenDepth
	);
	if (segments.length < 2) return;
	if (!segments.every((seg) => isIdentifierSegment(seg))) return;
	const foldedKey = buildFoldedKey(segments);
	const absolutePath = pathPrefix ? `${pathPrefix}.${foldedKey}` : foldedKey;
	if (siblings.includes(foldedKey)) return;
	if (rootLiteralKeys && rootLiteralKeys.has(absolutePath)) return;
	return {
		foldedKey,
		remainder: tail,
		leafValue,
		segmentCount: segments.length
	};
}
function collectSingleKeyChain(startKey, startValue, maxDepth) {
	const segments = [startKey];
	let currentValue = startValue;
	while (segments.length < maxDepth) {
		if (!isJsonObject(currentValue)) break;
		const keys = Object.keys(currentValue);
		if (keys.length !== 1) break;
		const nextKey = keys[0];
		const nextValue = currentValue[nextKey];
		segments.push(nextKey);
		currentValue = nextValue;
	}
	if (!isJsonObject(currentValue) || isEmptyObject(currentValue))
		return {
			segments,
			tail: void 0,
			leafValue: currentValue
		};
	return {
		segments,
		tail: currentValue,
		leafValue: currentValue
	};
}
function buildFoldedKey(segments) {
	return segments.join('.');
}
function encodePrimitive(value, delimiter) {
	if (value === null) return NULL_LITERAL;
	if (typeof value === 'boolean') return String(value);
	if (typeof value === 'number') return String(value);
	return encodeStringLiteral(value, delimiter);
}
function encodeStringLiteral(value, delimiter = DEFAULT_DELIMITER) {
	if (isSafeUnquoted(value, delimiter)) return value;
	return `"${escapeString(value)}"`;
}
function encodeKey(key) {
	if (isValidUnquotedKey(key)) return key;
	return `"${escapeString(key)}"`;
}
function encodeAndJoinPrimitives(values, delimiter = DEFAULT_DELIMITER) {
	return values.map((v) => encodePrimitive(v, delimiter)).join(delimiter);
}
function formatHeader(length, options) {
	const key = options?.key;
	const fields = options?.fields;
	const delimiter = options?.delimiter ?? ',';
	let header = '';
	if (key != null) header += encodeKey(key);
	header += `[${length}${delimiter !== DEFAULT_DELIMITER ? delimiter : ''}]`;
	if (fields) {
		const quotedFields = fields.map((f) => encodeKey(f));
		header += `{${quotedFields.join(delimiter)}}`;
	}
	header += ':';
	return header;
}
function* encodeJsonValue(value, options, depth) {
	if (isJsonPrimitive(value)) {
		const encodedPrimitive = encodePrimitive(value, options.delimiter);
		if (encodedPrimitive !== '') yield encodedPrimitive;
		return;
	}
	if (isJsonArray(value)) yield* encodeArrayLines(void 0, value, depth, options);
	else if (isJsonObject(value)) yield* encodeObjectLines(value, depth, options);
}
function* encodeObjectLines(value, depth, options, rootLiteralKeys, pathPrefix, remainingDepth) {
	const keys = Object.keys(value);
	if (depth === 0 && !rootLiteralKeys)
		rootLiteralKeys = new Set(keys.filter((k) => k.includes('.')));
	const effectiveFlattenDepth = remainingDepth ?? options.flattenDepth;
	for (const [key, val] of Object.entries(value))
		yield* encodeKeyValuePairLines(
			key,
			val,
			depth,
			options,
			keys,
			rootLiteralKeys,
			pathPrefix,
			effectiveFlattenDepth
		);
}
function* encodeKeyValuePairLines(
	key,
	value,
	depth,
	options,
	siblings,
	rootLiteralKeys,
	pathPrefix,
	flattenDepth
) {
	const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
	const effectiveFlattenDepth = flattenDepth ?? options.flattenDepth;
	if (options.keyFolding === 'safe' && siblings) {
		const foldResult = tryFoldKeyChain(
			key,
			value,
			siblings,
			options,
			rootLiteralKeys,
			pathPrefix,
			effectiveFlattenDepth
		);
		if (foldResult) {
			const { foldedKey, remainder, leafValue, segmentCount } = foldResult;
			const encodedFoldedKey = encodeKey(foldedKey);
			if (remainder === void 0) {
				if (isJsonPrimitive(leafValue)) {
					yield indentedLine(
						depth,
						`${encodedFoldedKey}: ${encodePrimitive(leafValue, options.delimiter)}`,
						options.indent
					);
					return;
				} else if (isJsonArray(leafValue)) {
					yield* encodeArrayLines(foldedKey, leafValue, depth, options);
					return;
				} else if (isJsonObject(leafValue) && isEmptyObject(leafValue)) {
					yield indentedLine(depth, `${encodedFoldedKey}:`, options.indent);
					return;
				}
			}
			if (isJsonObject(remainder)) {
				yield indentedLine(depth, `${encodedFoldedKey}:`, options.indent);
				const remainingDepth = effectiveFlattenDepth - segmentCount;
				const foldedPath = pathPrefix ? `${pathPrefix}.${foldedKey}` : foldedKey;
				yield* encodeObjectLines(
					remainder,
					depth + 1,
					options,
					rootLiteralKeys,
					foldedPath,
					remainingDepth
				);
				return;
			}
		}
	}
	const encodedKey = encodeKey(key);
	if (isJsonPrimitive(value))
		yield indentedLine(
			depth,
			`${encodedKey}: ${encodePrimitive(value, options.delimiter)}`,
			options.indent
		);
	else if (isJsonArray(value)) yield* encodeArrayLines(key, value, depth, options);
	else if (isJsonObject(value)) {
		yield indentedLine(depth, `${encodedKey}:`, options.indent);
		if (!isEmptyObject(value))
			yield* encodeObjectLines(
				value,
				depth + 1,
				options,
				rootLiteralKeys,
				currentPath,
				effectiveFlattenDepth
			);
	}
}
function* encodeArrayLines(key, value, depth, options) {
	if (value.length === 0) {
		yield indentedLine(depth, key != null ? `${encodeKey(key)}: []` : '[]', options.indent);
		return;
	}
	if (isArrayOfPrimitives(value)) {
		yield indentedLine(depth, encodeInlineArrayLine(value, options.delimiter, key), options.indent);
		return;
	}
	if (isArrayOfArrays(value)) {
		if (value.every((arr) => isArrayOfPrimitives(arr))) {
			yield* encodeArrayOfArraysAsListItemsLines(key, value, depth, options);
			return;
		}
	}
	if (isArrayOfObjects(value)) {
		const header = extractTabularHeader(value);
		if (header) yield* encodeArrayOfObjectsAsTabularLines(key, value, header, depth, options);
		else yield* encodeMixedArrayAsListItemsLines(key, value, depth, options);
		return;
	}
	yield* encodeMixedArrayAsListItemsLines(key, value, depth, options);
}
function* encodeArrayOfArraysAsListItemsLines(prefix, values, depth, options) {
	yield indentedLine(
		depth,
		formatHeader(values.length, {
			key: prefix,
			delimiter: options.delimiter
		}),
		options.indent
	);
	for (const arr of values)
		if (isArrayOfPrimitives(arr)) {
			const arrayLine = encodeInlineArrayLine(arr, options.delimiter);
			yield indentedListItem(depth + 1, arrayLine, options.indent);
		}
}
function encodeInlineArrayLine(values, delimiter, prefix) {
	const header = formatHeader(values.length, {
		key: prefix,
		delimiter
	});
	const joinedValue = encodeAndJoinPrimitives(values, delimiter);
	if (values.length === 0) return header;
	return `${header} ${joinedValue}`;
}
function* encodeArrayOfObjectsAsTabularLines(prefix, rows, header, depth, options) {
	yield indentedLine(
		depth,
		formatHeader(rows.length, {
			key: prefix,
			fields: header,
			delimiter: options.delimiter
		}),
		options.indent
	);
	yield* writeTabularRowsLines(rows, header, depth + 1, options);
}
function extractTabularHeader(rows) {
	if (rows.length === 0) return;
	const firstRow = rows[0];
	const firstKeys = Object.keys(firstRow);
	if (firstKeys.length === 0) return;
	if (isTabularArray(rows, firstKeys)) return firstKeys;
}
function isTabularArray(rows, header) {
	for (const row of rows) {
		if (Object.keys(row).length !== header.length) return false;
		for (const key of header) {
			if (!Object.hasOwn(row, key)) return false;
			if (!isJsonPrimitive(row[key])) return false;
		}
	}
	return true;
}
function* writeTabularRowsLines(rows, header, depth, options) {
	for (const row of rows)
		yield indentedLine(
			depth,
			encodeAndJoinPrimitives(
				header.map((key) => row[key]),
				options.delimiter
			),
			options.indent
		);
}
function* encodeMixedArrayAsListItemsLines(prefix, items, depth, options) {
	yield indentedLine(
		depth,
		formatHeader(items.length, {
			key: prefix,
			delimiter: options.delimiter
		}),
		options.indent
	);
	for (const item of items) yield* encodeListItemValueLines(item, depth + 1, options);
}
function* encodeObjectAsListItemLines(obj, depth, options) {
	if (isEmptyObject(obj)) {
		yield indentedLine(depth, '-', options.indent);
		return;
	}
	const entries = Object.entries(obj);
	const [firstKey, firstValue] = entries[0];
	const restEntries = entries.slice(1);
	if (isJsonArray(firstValue) && isArrayOfObjects(firstValue)) {
		const header = extractTabularHeader(firstValue);
		if (header) {
			yield indentedListItem(
				depth,
				formatHeader(firstValue.length, {
					key: firstKey,
					fields: header,
					delimiter: options.delimiter
				}),
				options.indent
			);
			yield* writeTabularRowsLines(firstValue, header, depth + 2, options);
			if (restEntries.length > 0)
				yield* encodeObjectLines(Object.fromEntries(restEntries), depth + 1, options);
			return;
		}
	}
	const encodedKey = encodeKey(firstKey);
	if (isJsonPrimitive(firstValue))
		yield indentedListItem(
			depth,
			`${encodedKey}: ${encodePrimitive(firstValue, options.delimiter)}`,
			options.indent
		);
	else if (isJsonArray(firstValue))
		if (firstValue.length === 0) yield indentedListItem(depth, `${encodedKey}: []`, options.indent);
		else if (isArrayOfPrimitives(firstValue))
			yield indentedListItem(
				depth,
				`${encodedKey}${encodeInlineArrayLine(firstValue, options.delimiter)}`,
				options.indent
			);
		else {
			yield indentedListItem(
				depth,
				`${encodedKey}${formatHeader(firstValue.length, { delimiter: options.delimiter })}`,
				options.indent
			);
			for (const item of firstValue) yield* encodeListItemValueLines(item, depth + 2, options);
		}
	else if (isJsonObject(firstValue)) {
		yield indentedListItem(depth, `${encodedKey}:`, options.indent);
		if (!isEmptyObject(firstValue)) yield* encodeObjectLines(firstValue, depth + 2, options);
	}
	if (restEntries.length > 0)
		yield* encodeObjectLines(Object.fromEntries(restEntries), depth + 1, options);
}
function* encodeListItemValueLines(value, depth, options) {
	if (isJsonPrimitive(value))
		yield indentedListItem(depth, encodePrimitive(value, options.delimiter), options.indent);
	else if (isJsonArray(value))
		if (isArrayOfPrimitives(value))
			yield indentedListItem(
				depth,
				encodeInlineArrayLine(value, options.delimiter),
				options.indent
			);
		else {
			yield indentedListItem(
				depth,
				formatHeader(value.length, { delimiter: options.delimiter }),
				options.indent
			);
			for (const item of value) yield* encodeListItemValueLines(item, depth + 1, options);
		}
	else if (isJsonObject(value)) yield* encodeObjectAsListItemLines(value, depth, options);
}
function indentedLine(depth, content, indentSize) {
	return ' '.repeat(indentSize * depth) + content;
}
function indentedListItem(depth, content, indentSize) {
	return indentedLine(depth, '- ' + content, indentSize);
}
function applyReplacer(root, replacer) {
	const replacedRoot = replacer('', root, []);
	if (replacedRoot === void 0) return transformChildren(root, replacer, []);
	return transformChildren(normalizeValue(replacedRoot), replacer, []);
}
function transformChildren(value, replacer, path) {
	if (isJsonObject(value)) return transformObject(value, replacer, path);
	if (isJsonArray(value)) return transformArray(value, replacer, path);
	return value;
}
function transformObject(obj, replacer, path) {
	const result = {};
	for (const [key, value] of Object.entries(obj)) {
		const childPath = [...path, key];
		const replacedValue = replacer(key, value, childPath);
		if (replacedValue === void 0) continue;
		setOwnProperty(
			result,
			key,
			transformChildren(normalizeValue(replacedValue), replacer, childPath)
		);
	}
	return result;
}
function transformArray(arr, replacer, path) {
	const result = [];
	for (let i = 0; i < arr.length; i++) {
		const value = arr[i];
		const childPath = [...path, i];
		const replacedValue = replacer(String(i), value, childPath);
		if (replacedValue === void 0) continue;
		const normalizedValue = normalizeValue(replacedValue);
		result.push(transformChildren(normalizedValue, replacer, childPath));
	}
	return result;
}
function encode(input, options) {
	return Array.from(encodeLines(input, options)).join('\n');
}
function encodeLines(input, options) {
	const normalizedValue = normalizeValue(input);
	const resolvedOptions = resolveOptions(options);
	return encodeJsonValue(
		resolvedOptions.replacer
			? applyReplacer(normalizedValue, resolvedOptions.replacer)
			: normalizedValue,
		resolvedOptions,
		0
	);
}
function resolveOptions(options) {
	return {
		indent: options?.indent ?? 2,
		delimiter: options?.delimiter ?? DEFAULT_DELIMITER,
		keyFolding: options?.keyFolding ?? 'off',
		flattenDepth: options?.flattenDepth ?? Number.POSITIVE_INFINITY,
		replacer: options?.replacer
	};
}

// node_modules/axi-sdk-js/dist/output.js
function collapseHomeDirectory(path, homeDir = homedir()) {
	if (!path.startsWith(homeDir)) {
		return path;
	}
	return `~${path.slice(homeDir.length)}`;
}
function homeHeaderOutput(options) {
	return {
		bin: collapseHomeDirectory(options.execPath ?? process.argv[1] ?? '', options.homeDir),
		description: options.description
	};
}
function errorOutput(message, code, suggestions = []) {
	const output = {
		error: message,
		code
	};
	if (suggestions.length > 0) {
		output.help = suggestions;
	}
	return output;
}
function renderOutput(output) {
	if (typeof output === 'string') {
		return output;
	}
	return encode(output);
}
function renderError(message, code, suggestions = []) {
	return renderOutput(errorOutput(message, code, suggestions));
}

// node_modules/axi-sdk-js/dist/update.js
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';
var execFileAsync = promisify(execFile);
var REGISTRY_BASE = 'https://registry.npmjs.org';
var REGISTRY_FETCH_TIMEOUT_MS = 2e4;
function parseSemver(version) {
	const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+[0-9A-Za-z-.]+)?$/.exec(
		version.trim()
	);
	if (!match) {
		return null;
	}
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		prerelease: match[4] ? match[4].split('.') : []
	};
}
function comparePrerelease(a, b) {
	if (a.length === 0 && b.length === 0) return 0;
	if (a.length === 0) return 1;
	if (b.length === 0) return -1;
	const length = Math.max(a.length, b.length);
	for (let index = 0; index < length; index += 1) {
		if (index >= a.length) return -1;
		if (index >= b.length) return 1;
		const left = a[index];
		const right = b[index];
		const leftNumeric = /^\d+$/.test(left);
		const rightNumeric = /^\d+$/.test(right);
		if (leftNumeric && rightNumeric) {
			const delta = Number(left) - Number(right);
			if (delta !== 0) return delta < 0 ? -1 : 1;
		} else if (leftNumeric) {
			return -1;
		} else if (rightNumeric) {
			return 1;
		} else if (left !== right) {
			return left < right ? -1 : 1;
		}
	}
	return 0;
}
function compareSemver(a, b) {
	const parsedA = parseSemver(a);
	const parsedB = parseSemver(b);
	if (!parsedA || !parsedB) {
		if (a === b) return 0;
		return a < b ? -1 : 1;
	}
	if (parsedA.major !== parsedB.major) {
		return parsedA.major < parsedB.major ? -1 : 1;
	}
	if (parsedA.minor !== parsedB.minor) {
		return parsedA.minor < parsedB.minor ? -1 : 1;
	}
	if (parsedA.patch !== parsedB.patch) {
		return parsedA.patch < parsedB.patch ? -1 : 1;
	}
	return comparePrerelease(parsedA.prerelease, parsedB.prerelease);
}
function isUpdateAvailable(current, latest) {
	return compareSemver(latest, current) > 0;
}
var nodeFs = {
	existsSync,
	readFileSync: (path, encoding) => readFileSync(path, encoding)
};
function readNearestPackageJson(startPath, fs = nodeFs) {
	let dir = dirname(startPath);
	let previous = '';
	while (dir !== previous) {
		const packageJsonPath = join(dir, 'package.json');
		if (fs.existsSync(packageJsonPath)) {
			try {
				const parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
				if (typeof parsed.name === 'string' && parsed.name.length > 0) {
					return {
						packageName: parsed.name,
						version: typeof parsed.version === 'string' ? parsed.version : void 0,
						packageJsonPath
					};
				}
			} catch {}
		}
		previous = dir;
		dir = dirname(dir);
	}
	return {};
}
function detectInstallMethod(options) {
	const env = options.env ?? process.env;
	const path = options.entry.replaceAll('\\', '/');
	if (
		path.includes('/_npx/') ||
		/\/dlx-[^/]+\//.test(path) ||
		path.includes('/pnpm/dlx/') ||
		path.includes('/bun/install/cache/')
	) {
		return { kind: 'npx' };
	}
	const homebrewFormula = homebrewFormulaFromPath(path, env);
	if (homebrewFormula) {
		return { kind: 'homebrew', formula: homebrewFormula };
	}
	const pnpmHome = normalizePathRoot(env.PNPM_HOME);
	if (isPathInsideRoot(path, pnpmHome) || isKnownPnpmGlobalStore(path, env)) {
		return { kind: 'pnpm-global' };
	}
	if (isKnownNpmGlobalInstall(path, env)) {
		return { kind: 'npm-global' };
	}
	return { kind: 'unknown' };
}
function normalizePathRoot(path) {
	const normalized = path?.replaceAll('\\', '/').replace(/\/+$/, '');
	return normalized && normalized.length > 0 ? normalized : void 0;
}
function isPathInsideRoot(path, root) {
	return root !== void 0 && (path === root || path.startsWith(`${root}/`));
}
function homebrewFormulaFromPath(path, env) {
	for (const root of homebrewCellarRoots(env)) {
		if (!isPathInsideRoot(path, root)) {
			continue;
		}
		const relative = path.slice(root.length).replace(/^\/+/, '');
		const formula = relative.split('/')[0];
		if (formula) {
			return formula;
		}
	}
	return null;
}
function homebrewCellarRoots(env) {
	const roots = [];
	const explicitCellar = normalizePathRoot(env.HOMEBREW_CELLAR);
	if (explicitCellar) {
		roots.push(explicitCellar);
	}
	const prefixes = [
		env.HOMEBREW_PREFIX,
		'/opt/homebrew',
		'/usr/local',
		'/home/linuxbrew/.linuxbrew'
	];
	for (const prefix of prefixes) {
		const normalized = normalizePathRoot(prefix);
		if (normalized) {
			roots.push(`${normalized}/Cellar`);
		}
	}
	return [...new Set(roots)];
}
function isKnownPnpmGlobalStore(path, env) {
	return pnpmGlobalStoreRoots(env).some((root) => {
		if (!isPathInsideRoot(path, root)) {
			return false;
		}
		const relative = path.slice(root.length).replace(/^\/+/, '');
		return /^\d+\/\.pnpm\//.test(relative);
	});
}
function pnpmGlobalStoreRoots(env) {
	const roots = [];
	const home2 = normalizePathRoot(env.HOME ?? env.USERPROFILE);
	if (home2) {
		roots.push(`${home2}/Library/pnpm/global`);
		roots.push(`${home2}/.local/share/pnpm/global`);
		roots.push(`${home2}/AppData/Local/pnpm/global`);
	}
	const localAppData = normalizePathRoot(env.LOCALAPPDATA);
	if (localAppData) {
		roots.push(`${localAppData}/pnpm/global`);
	}
	return [...new Set(roots)];
}
function isKnownNpmGlobalInstall(path, env) {
	return (
		npmGlobalNodeModulesRoots(env).some((root) => isPathInsideRoot(path, root)) ||
		isKnownVersionManagerNpmGlobal(path, env)
	);
}
function npmGlobalNodeModulesRoots(env) {
	const roots = [
		'/usr/local/lib/node_modules',
		'/usr/lib/node_modules',
		'/opt/homebrew/lib/node_modules',
		'/opt/local/lib/node_modules'
	];
	const prefixes = [env.npm_config_prefix, env.NPM_CONFIG_PREFIX];
	for (const prefix of prefixes) {
		const normalized = normalizePathRoot(prefix);
		if (normalized) {
			roots.push(`${normalized}/lib/node_modules`, `${normalized}/node_modules`);
		}
	}
	const appData = normalizePathRoot(env.APPDATA);
	if (appData) {
		roots.push(`${appData}/npm/node_modules`);
	}
	const home2 = normalizePathRoot(env.HOME ?? env.USERPROFILE);
	if (home2) {
		roots.push(`${home2}/.npm-global/lib/node_modules`, `${home2}/.npm-packages/lib/node_modules`);
	}
	return [...new Set(roots)];
}
function isKnownVersionManagerNpmGlobal(path, env) {
	return versionManagerNodeRoots(env).some(
		(root) => isPathInsideRoot(path, root) && path.includes('/lib/node_modules/')
	);
}
function versionManagerNodeRoots(env) {
	const roots = [];
	const home2 = normalizePathRoot(env.HOME ?? env.USERPROFILE);
	if (home2) {
		roots.push(
			`${home2}/.nvm/versions/node`,
			`${home2}/.local/share/fnm/node-versions`,
			`${home2}/.asdf/installs/nodejs`,
			`${home2}/.nodenv/versions`,
			`${home2}/.local/share/mise/installs/node`,
			`${home2}/.volta/tools/image/node`
		);
	}
	const nvmDir = normalizePathRoot(env.NVM_DIR);
	if (nvmDir) {
		roots.push(`${nvmDir}/versions/node`);
	}
	const fnmDir = normalizePathRoot(env.FNM_DIR);
	if (fnmDir) {
		roots.push(`${fnmDir}/node-versions`);
	}
	return [...new Set(roots)];
}
function planUpgrade(method, packageName) {
	switch (method.kind) {
		case 'npm-global':
			return {
				method: method.kind,
				command: `npm install -g ${packageName}@latest`,
				argv: ['npm', 'install', '-g', `${packageName}@latest`]
			};
		case 'pnpm-global':
			return {
				method: method.kind,
				command: `pnpm add -g ${packageName}@latest`,
				argv: ['pnpm', 'add', '-g', `${packageName}@latest`]
			};
		case 'homebrew':
			if (method.formula) {
				return {
					method: method.kind,
					command: `brew upgrade ${method.formula}`,
					argv: ['brew', 'upgrade', method.formula]
				};
			}
			return {
				method: method.kind,
				command: `brew upgrade ${packageName}`,
				argv: null,
				note: 'Could not determine the Homebrew formula automatically'
			};
		case 'npx':
			return {
				method: method.kind,
				command: `npx -y ${packageName}@latest`,
				argv: null,
				note: 'npx always runs the latest published version, so no install is needed'
			};
		case 'unknown':
			return {
				method: method.kind,
				command: `npm install -g ${packageName}@latest`,
				argv: null,
				note: 'Could not determine how this tool was installed'
			};
	}
}
function packageManagerExecutable(command, platform) {
	if (platform === 'win32' && (command === 'npm' || command === 'pnpm' || command === 'npx')) {
		return `${command}.cmd`;
	}
	return command;
}
function shouldUseWindowsPackageManagerShell(command, platform) {
	return platform === 'win32' && (command === 'npm' || command === 'pnpm' || command === 'npx');
}
async function npmViewVersion(packageName, platform = process.platform) {
	try {
		const command = packageManagerExecutable('npm', platform);
		const { stdout } = await execFileAsync(command, ['view', packageName, 'version'], {
			timeout: 2e4,
			shell: shouldUseWindowsPackageManagerShell('npm', platform)
		});
		const version = stdout.trim();
		return version.length > 0 ? version : null;
	} catch {
		return null;
	}
}
function registryPath(packageName) {
	return packageName.startsWith('@') ? packageName.replace('/', '%2f') : packageName;
}
function notPublishedError(packageName) {
	return new AxiError(`${packageName} is not published to the npm registry`, 'UPDATE_ERROR', [
		'Confirm the package name is correct',
		`Run \`npm view ${packageName} version\` to check manually`
	]);
}
var RegistryNotFoundError = class extends Error {};
async function withRegistryTimeout(timeoutMs, operation) {
	const controller = new AbortController();
	let timer;
	const timeout = new Promise((_resolve, reject) => {
		timer = setTimeout(() => {
			controller.abort();
			reject(new Error(`Registry fetch timed out after ${timeoutMs}ms`));
		}, timeoutMs);
		timer.unref?.();
	});
	try {
		return await Promise.race([operation(controller.signal), timeout]);
	} finally {
		if (timer) {
			clearTimeout(timer);
		}
	}
}
async function fetchRegistryVersion(fetchImpl, packageName, timeoutMs) {
	return withRegistryTimeout(timeoutMs, async (signal) => {
		const response = await fetchImpl(`${REGISTRY_BASE}/${registryPath(packageName)}/latest`, {
			headers: { accept: 'application/json' },
			signal
		});
		if (response.ok) {
			const data = await response.json();
			if (typeof data.version === 'string' && data.version.length > 0) {
				return data.version;
			}
		} else if (response.status === 404) {
			throw new RegistryNotFoundError();
		}
		return null;
	});
}
async function fetchLatestVersion(packageName, options = {}) {
	const fetchImpl = options.fetchImpl === void 0 ? globalThis.fetch : (options.fetchImpl ?? void 0);
	let registryNotFound = false;
	if (typeof fetchImpl === 'function') {
		try {
			const version = await fetchRegistryVersion(
				fetchImpl,
				packageName,
				options.fetchTimeoutMs ?? REGISTRY_FETCH_TIMEOUT_MS
			);
			if (version) {
				return version;
			}
		} catch (error) {
			if (error instanceof RegistryNotFoundError) {
				registryNotFound = true;
			} else if (error instanceof AxiError) {
				throw error;
			}
		}
	}
	const viewed = await (options.npmView ?? ((name) => npmViewVersion(name, options.platform)))(
		packageName
	);
	if (viewed) {
		return viewed;
	}
	if (registryNotFound) {
		throw notPublishedError(packageName);
	}
	throw new AxiError(
		`Could not reach the npm registry to check for updates to ${packageName}`,
		'UPDATE_ERROR',
		[
			'Check your network connection and try again',
			`Run \`npm view ${packageName} version\` to check manually`
		]
	);
}
async function defaultRunInstall(plan, stdout, context) {
	const argv = plan.argv;
	if (!argv || argv.length === 0) {
		return { ok: false, message: 'No runnable upgrade command' };
	}
	stdout.write(`running: ${plan.command}
`);
	return new Promise((resolve) => {
		const [command, ...args] = argv;
		const child = spawn(packageManagerExecutable(command, context.platform), args, {
			stdio: ['ignore', 'pipe', 'pipe'],
			shell: shouldUseWindowsPackageManagerShell(command, context.platform)
		});
		child.stdout?.on('data', (chunk) => {
			process.stderr.write(chunk);
		});
		child.stderr?.on('data', (chunk) => {
			process.stderr.write(chunk);
		});
		child.on('error', (error) => {
			resolve({ ok: false, message: error.message });
		});
		child.on('close', (code) => {
			resolve(
				code === 0
					? { ok: true }
					: { ok: false, message: `${plan.command} exited with code ${code}` }
			);
		});
	});
}
function binNameFromArgv(invokedAs) {
	return basename(invokedAs ?? 'tool') || 'tool';
}
function resolveEntry(invokedAs, realpath) {
	if (!invokedAs) {
		return void 0;
	}
	try {
		return realpath(invokedAs);
	} catch {
		return invokedAs;
	}
}
function resolveInstalledVersion(invokedAs, realpath, fs) {
	const installedEntry = resolveEntry(invokedAs, realpath);
	return installedEntry ? readNearestPackageJson(installedEntry, fs).version : void 0;
}
function homebrewUpgradeOutput(options) {
	const update = {
		package: options.packageName,
		previous: options.current,
		latest: options.latest
	};
	if (options.installedVersion) {
		update.installed = options.installedVersion;
		update.available = isUpdateAvailable(options.installedVersion, options.latest);
	} else {
		update.action = 'upgrade-command-ran';
		update.result = 'installed version unknown';
	}
	return {
		update,
		command: options.command
	};
}
function parseUpdateArgs(args, binName) {
	if (args.length === 0) {
		return 'install';
	}
	if (args.length === 1 && (args[0] === '--check' || args[0] === '--dry-run')) {
		return 'check';
	}
	const unknown = args.find((arg) => arg !== '--check' && arg !== '--dry-run');
	throw new AxiError(
		unknown ? `Unknown update option: ${unknown}` : 'Invalid update arguments',
		'VALIDATION_ERROR',
		[
			`Run \`${binName} update --help\``,
			`Use \`${binName} update --check\` to check without installing`
		]
	);
}
async function runUpdate(options) {
	const invokedAs = options.invokedAs ?? process.argv[1];
	const binName = binNameFromArgv(invokedAs);
	const mode = parseUpdateArgs(options.args, binName);
	const platform = options.platform ?? process.platform;
	const realpath = options.realpath ?? ((path) => realpathSync(path));
	const entry = resolveEntry(invokedAs, realpath);
	const fs = options.fs ?? nodeFs;
	const fromPackageJson = entry ? readNearestPackageJson(entry, fs) : {};
	const packageName = options.packageName ?? fromPackageJson.packageName;
	const current = options.version ?? fromPackageJson.version;
	if (!packageName) {
		throw new AxiError('Could not determine the package name to update', 'UPDATE_ERROR', [
			'Reinstall the tool from npm so its package.json is available',
			'Tool authors can pass `packageName` to runAxiCli()'
		]);
	}
	if (!current) {
		throw new AxiError(
			`Could not determine the current version of ${packageName}`,
			'UPDATE_ERROR',
			[
				'Reinstall the tool from npm so its version is available',
				'Tool authors can pass `version` to runAxiCli()'
			]
		);
	}
	const fetchLatest = options.fetchLatest ?? ((name) => fetchLatestVersion(name, { platform }));
	const latest = await fetchLatest(packageName);
	const available = isUpdateAvailable(current, latest);
	if (mode === 'check') {
		const output = {
			update: { package: packageName, current, latest, available }
		};
		if (available) {
			output.help = [`Run \`${binName} update\` to upgrade`];
		}
		return output;
	}
	if (!available) {
		return {
			update: `${packageName} is already on the latest version (${current})`
		};
	}
	const method = entry ? detectInstallMethod({ entry, env: options.env }) : { kind: 'unknown' };
	const plan = planUpgrade(method, packageName);
	if (!plan.argv) {
		const help =
			method.kind === 'npx'
				? `Re-run with \`${plan.command}\` to use the latest version`
				: `Run \`${plan.command}\` to upgrade`;
		return {
			update: {
				package: packageName,
				current,
				latest,
				available: true,
				action: 'manual',
				...(plan.note ? { reason: plan.note } : {}),
				run: plan.command
			},
			help: [help]
		};
	}
	const runInstall = options.runInstall ?? defaultRunInstall;
	const result = await runInstall(plan, options.stdout, { platform });
	if (!result.ok) {
		throw new AxiError(`Failed to upgrade ${packageName}`, 'UPDATE_ERROR', [
			`Run \`${plan.command}\` manually`,
			...(result.message ? [result.message] : [])
		]);
	}
	if (method.kind === 'homebrew') {
		return homebrewUpgradeOutput({
			packageName,
			current,
			latest,
			installedVersion: resolveInstalledVersion(invokedAs, realpath, fs),
			command: plan.command
		});
	}
	return {
		update: `${packageName} upgraded ${current} -> ${latest}`,
		command: plan.command
	};
}

// node_modules/axi-sdk-js/dist/cli.js
function defaultFormatError(error) {
	if (error instanceof AxiError) {
		return {
			output: `${renderError(error.message, error.code, error.suggestions)}
`,
			exitCode: exitCodeForError(error)
		};
	}
	const message = error instanceof Error ? error.message : String(error);
	return {
		output: `${renderError(message, 'UNKNOWN')}
`,
		exitCode: 1
	};
}
function defaultUnknownCommand(command) {
	return `${renderError(`Unknown command: ${command}`, 'VALIDATION_ERROR', [
		'Run `--help` to see available commands'
	])}
`;
}
async function runAxiCli(options) {
	options.initialize?.();
	const stdout = options.stdout ?? process.stdout;
	const argv = options.argv ?? process.argv.slice(2);
	if (argv.length === 1 && argv[0] === '--help') {
		stdout.write(options.topLevelHelp);
		if (!options.commands.update) {
			if (options.topLevelHelp.length > 0 && !options.topLevelHelp.endsWith('\n')) {
				stdout.write('\n');
			}
			stdout.write(builtinCommandsHelp());
		}
		return;
	}
	if (argv.length === 1 && isVersionFlag(argv[0])) {
		if (!options.version) {
			stdout.write(`${renderError('Version is not configured for this tool', 'VALIDATION_ERROR')}
`);
			process.exitCode = 2;
			return;
		}
		stdout.write(`${options.version}
`);
		return;
	}
	const command = argv[0];
	if (!command) {
		const context2 = await options.resolveContext?.({
			command: void 0,
			args: []
		});
		await runHandler(options.home, [], context2, stdout, options, true);
		return;
	}
	if (command.startsWith('-')) {
		stdout.write(renderLeadingFlagError(command));
		process.exitCode = 2;
		return;
	}
	const args = argv.slice(1);
	if (command === 'update' && !options.commands.update) {
		await runBuiltinUpdate(args, stdout, options);
		return;
	}
	if (args.includes('--help')) {
		const help = options.getCommandHelp?.(command);
		if (help) {
			stdout.write(help);
			return;
		}
	}
	const handler = options.commands[command];
	if (!handler) {
		stdout.write((options.renderUnknownCommand ?? defaultUnknownCommand)(command));
		process.exitCode = 2;
		return;
	}
	const context = await options.resolveContext?.({ command, args });
	await runHandler(handler, args, context, stdout, options, false);
}
async function runHandler(handler, args, context, stdout, options, isHomeView) {
	try {
		const output = await handler(args, context);
		stdout.write(`${renderCommandOutput(output, options, isHomeView)}
`);
	} catch (error) {
		const formatted = (options.formatError ?? defaultFormatError)(error);
		stdout.write(formatted.output);
		process.exitCode = formatted.exitCode;
	}
}
async function runBuiltinUpdate(args, stdout, options) {
	if (args.length === 1 && args[0] === '--help') {
		stdout.write(builtinUpdateHelp());
		return;
	}
	try {
		const output = await runUpdate({
			args,
			stdout,
			packageName: options.packageName,
			version: options.version
		});
		stdout.write(`${renderOutput(output)}
`);
	} catch (error) {
		const formatted = (options.formatError ?? defaultFormatError)(error);
		stdout.write(formatted.output);
		process.exitCode = formatted.exitCode;
	}
}
function resolveBinName() {
	return basename2(process.argv[1] ?? 'tool') || 'tool';
}
function builtinCommandsHelp() {
	const bin = resolveBinName();
	return `${renderOutput({
		'built-in': {
			update: `Upgrade \`${bin}\` to the latest published version`,
			'update --check': 'Report current vs latest without installing'
		}
	})}
`;
}
function builtinUpdateHelp() {
	const bin = resolveBinName();
	return `${renderOutput({
		command: 'update',
		description: `Upgrade \`${bin}\` to the latest published npm version`,
		flags: {
			'--check': 'Report current vs latest and exit without installing'
		},
		examples: [`${bin} update`, `${bin} update --check`]
	})}
`;
}
function renderLeadingFlagError(flag) {
	const bin = basename2(process.argv[1] ?? 'tool') || 'tool';
	return `${renderError('Flags must come after the command', 'VALIDATION_ERROR', [
		`Run \`${bin} <command> [args] [flags]\``,
		`Move \`${flag}\` after the command instead of before it`
	])}
`;
}
function isVersionFlag(flag) {
	return flag === '-v' || flag === '-V' || flag === '--version';
}
function renderCommandOutput(output, options, isHomeView) {
	if (!isHomeView) {
		return renderOutput(output);
	}
	const header = homeHeaderOutput({ description: options.description });
	if (typeof output === 'string') {
		return `${renderOutput(header)}
${output}`;
	}
	return renderOutput(mergeHomeHeader(header, output));
}
function mergeHomeHeader(header, output) {
	const rest = { ...output };
	delete rest.bin;
	delete rest.description;
	return {
		...header,
		...rest
	};
}

// src/lib/work3-shared/errors.ts
var WORK3_ERROR_EXIT_CLASS = {
	unknown_command: 2,
	validation_failed: 2,
	not_found: 3,
	transition_not_allowed: 4,
	transition_requirements_not_met: 4,
	invariant_violation: 4,
	version_conflict: 5,
	idempotency_conflict: 5,
	authority_required: 6,
	authorization_invalid: 6,
	runtime_unavailable: 7,
	internal_error: 1
};

// src/cli/errors.ts
var CLI_EXIT_CLASS = {
	...WORK3_ERROR_EXIT_CLASS,
	usage: 2,
	unauthorized: 6,
	network: 7
};
var CliError = class extends Error {
	code;
	details;
	suggestions;
	constructor(code, message, options = {}) {
		super(message);
		this.name = 'CliError';
		this.code = code;
		this.details = options.details ?? {};
		this.suggestions = options.suggestions ?? [];
	}
	get exitCode() {
		return CLI_EXIT_CLASS[this.code] ?? 1;
	}
};
function cliErrorFromShape(shape) {
	return new CliError(shape.code, shape.message, {
		details: shape.details,
		suggestions: shape.alternatives?.map((name) => `Valid: ${name}`) ?? []
	});
}
function exitCodeFor(error) {
	return error instanceof CliError ? error.exitCode : 1;
}

// src/cli/config.ts
import { existsSync as existsSync2, readdirSync, readFileSync as readFileSync2 } from 'node:fs';
import { homedir as homedir2 } from 'node:os';
import { join as join2 } from 'node:path';
function readFileConfig() {
	const path = join2(homedir2(), '.config', 'falcon-dash', 'cli.json');
	if (!existsSync2(path)) return {};
	try {
		return JSON.parse(readFileSync2(path, 'utf-8'));
	} catch {
		throw new CliError('usage', `Config file is not valid JSON: ${path}`);
	}
}
function tokenDir() {
	const dataDir =
		process.env.FALCON_DASH_DATA_DIR ?? join2(homedir2(), '.openclaw', 'data', 'falcon-dash');
	return join2(dataDir, 'tokens');
}
function discoverTokenFile(fileConfig) {
	const dir = tokenDir();
	if (!existsSync2(dir)) return null;
	const agentId = process.env.FALCON_AGENT_ID ?? fileConfig.agent_id;
	if (agentId) {
		const path = join2(dir, `${agentId}.token`);
		if (!existsSync2(path)) return null;
		return { token: readFileSync2(path, 'utf-8').trim(), source: path };
	}
	const candidates = readdirSync(dir).filter((name) => name.endsWith('.token'));
	if (candidates.length === 1) {
		const path = join2(dir, candidates[0]);
		return { token: readFileSync2(path, 'utf-8').trim(), source: path };
	}
	if (candidates.length > 1) {
		throw new CliError(
			'usage',
			`Multiple agent token files found in ${dir}; set FALCON_AGENT_ID to choose one`,
			{ details: { candidates } }
		);
	}
	return null;
}
function resolveConfig() {
	const fileConfig = readFileConfig();
	const baseUrl = (
		process.env.FALCON_DASH_URL ??
		fileConfig.url ??
		'http://127.0.0.1:3000'
	).replace(/\/$/, '');
	if (process.env.FALCON_DASH_TOKEN) {
		return { baseUrl, token: process.env.FALCON_DASH_TOKEN, tokenSource: 'env:FALCON_DASH_TOKEN' };
	}
	if (fileConfig.token) {
		return { baseUrl, token: fileConfig.token, tokenSource: 'config-file' };
	}
	const discovered = discoverTokenFile(fileConfig);
	if (discovered) {
		return { baseUrl, token: discovered.token, tokenSource: discovered.source };
	}
	throw new CliError(
		'unauthorized',
		'No agent token found. Set FALCON_DASH_TOKEN, or mint a token in Falcon Dash Settings \u2192 Agent Tokens (drops a token file for this host).',
		{ details: { token_dir: tokenDir() } }
	);
}

// src/cli/http.ts
async function request(path, init = {}) {
	const config = resolveConfig();
	let response;
	try {
		response = await fetch(config.baseUrl + path, {
			...init,
			headers: {
				Authorization: `Bearer ${config.token}`,
				'Content-Type': 'application/json',
				...init.headers
			}
		});
	} catch (error) {
		throw new CliError(
			'network',
			`Cannot reach Falcon Dash at ${config.baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
			{
				suggestions: ['Set FALCON_DASH_URL if the server runs elsewhere']
			}
		);
	}
	let body;
	try {
		body = await response.json();
	} catch {
		throw new CliError(
			'network',
			`Falcon Dash returned a non-JSON response (HTTP ${response.status})`
		);
	}
	if (!response.ok) {
		if (response.status === 401) {
			throw new CliError('unauthorized', body.message ?? 'Invalid or missing token');
		}
		throw cliErrorFromShape(body);
	}
	return body;
}
async function apiGet(path) {
	return await request(path);
}
async function apiPost(path, body) {
	return await request(path, { method: 'POST', body: JSON.stringify(body) });
}
async function apiCommand(params) {
	return await request(`/api/v3/commands/${params.command}`, {
		method: 'POST',
		body: JSON.stringify({
			target: params.target,
			expected_version: params.expectedVersion,
			idempotency_key: params.idempotencyKey,
			payload: params.payload ?? {}
		})
	});
}
async function currentVersion(type, id) {
	const detail = await apiGet(`/api/v3/objects/${type}/${id}?view=detail`);
	const item = detail.item;
	return item.version;
}

// src/lib/work3-shared/commands.ts
var WORK3_COMMANDS = [
	// Area
	{
		name: 'create_area',
		target: null,
		summary: 'Create an Area (durable sphere of responsibility)',
		required: ['title'],
		optional: ['summary']
	},
	{
		name: 'update_area',
		target: 'area',
		summary: 'Edit Area title/summary (never lifecycle)',
		required: [],
		optional: ['title', 'summary']
	},
	{
		name: 'archive_area',
		target: 'area',
		summary: 'Archive an Area (Work must be reassigned or explicitly excepted)',
		required: [],
		optional: ['exception_reason']
	},
	{
		name: 'restore_area',
		target: 'area',
		summary: 'Restore an archived Area to active',
		required: [],
		optional: []
	},
	// Task
	{
		name: 'create_task',
		target: null,
		summary: 'Create a Task (a concrete action) in an Area',
		required: ['title', 'area_id'],
		optional: ['summary', 'completion_condition', 'priority', 'owner', 'due_at']
	},
	{
		name: 'update_task',
		target: 'task',
		summary: 'Edit Task definition fields (never lifecycle)',
		required: [],
		optional: ['title', 'summary', 'completion_condition', 'priority', 'owner', 'due_at', 'area_id']
	},
	{
		name: 'ready_task',
		target: 'task',
		summary: 'Mark a backlog Task ready to act (requires an owner)',
		required: [],
		optional: ['owner']
	},
	{
		name: 'start_task',
		target: 'task',
		summary: 'Start work on a ready Task (blocked Tasks cannot start)',
		required: [],
		optional: []
	},
	{
		name: 'wait_task',
		target: 'task',
		summary: 'Mark a Task waiting on a named response, event, or time',
		required: ['waiting_on', 'reason', 'resume_condition'],
		optional: ['follow_up_at']
	},
	{
		name: 'resume_task',
		target: 'task',
		summary: 'Resume a waiting Task (clears waiting metadata)',
		required: [],
		optional: ['to']
	},
	{
		name: 'submit_task_for_review',
		target: 'task',
		summary: 'Submit Task output for review (requires a result summary)',
		required: ['result_summary'],
		optional: []
	},
	{
		name: 'accept_task',
		target: 'task',
		summary: 'Accept reviewed Task output and complete the Task',
		required: [],
		optional: []
	},
	{
		name: 'complete_task',
		target: 'task',
		summary: 'Complete a Task directly (requires result summary)',
		required: [],
		optional: ['result_summary']
	},
	{
		name: 'cancel_task',
		target: 'task',
		summary: 'Cancel a Task (requires a reason; preserves history)',
		required: ['reason'],
		optional: []
	},
	{
		name: 'reopen_task',
		target: 'task',
		summary: 'Reopen a terminal Task to ready (requires a reason)',
		required: ['reason'],
		optional: []
	},
	// Blocker
	{
		name: 'create_blocker',
		target: null,
		summary: 'Record an explicit constraint preventing actionable Work from proceeding',
		required: ['blocked_id', 'source_kind', 'reason', 'resolution_condition'],
		optional: ['source_work_id', 'source_label', 'unblock_task_id']
	},
	{
		name: 'resolve_blocker',
		target: 'blocker',
		summary: 'Resolve a blocker (requires a summary of what cleared it)',
		required: ['summary'],
		optional: ['source_refs']
	},
	{
		name: 'invalidate_blocker',
		target: 'blocker',
		summary: 'Invalidate a blocker that was wrong or ceased to apply',
		required: ['reason'],
		optional: []
	},
	// Question
	{
		name: 'create_question',
		target: null,
		summary: 'Create a Question (missing knowledge that materially affects work)',
		required: ['question', 'area_id'],
		optional: [
			'context',
			'impact',
			'priority',
			'steward',
			'answerable_by',
			'working_hypothesis',
			'target_at'
		]
	},
	{
		name: 'update_question',
		target: 'question',
		summary: 'Edit Question context/impact/steward fields (never lifecycle)',
		required: [],
		optional: [
			'context',
			'impact',
			'priority',
			'steward',
			'answerable_by',
			'working_hypothesis',
			'target_at'
		]
	},
	{
		name: 'answer_question',
		target: 'question',
		summary: 'Answer a Question (immutable answer revision; supported answers need sources)',
		required: ['answer', 'confidence'],
		optional: ['source_refs']
	},
	{
		name: 'revise_answer',
		target: 'question',
		summary: 'Revise an answer (prior revision preserved; lifecycle stays answered)',
		required: ['answer', 'confidence'],
		optional: ['source_refs']
	},
	{
		name: 'withdraw_question',
		target: 'question',
		summary: 'Withdraw an unanswered Question (requires a reason)',
		required: ['reason'],
		optional: []
	},
	{
		name: 'reopen_question',
		target: 'question',
		summary: 'Reopen an answered/withdrawn Question (requires a reason)',
		required: ['reason'],
		optional: []
	},
	// Decision
	{
		name: 'create_decision',
		target: null,
		summary: 'Create a decision-ready Decision directly as pending',
		required: [
			'area_id',
			'title',
			'prompt',
			'consequence_of_no_decision',
			'deciders',
			'options',
			'recommendation'
		],
		optional: ['context', 'stakes', 'priority', 'needed_by']
	},
	{
		name: 'revise_decision',
		target: 'decision',
		summary: 'Replace a pending/deferred package with a new immutable revision',
		required: [
			'title',
			'prompt',
			'consequence_of_no_decision',
			'deciders',
			'options',
			'recommendation'
		],
		optional: ['context', 'stakes']
	},
	{
		name: 'decide',
		target: 'decision',
		summary: 'Record the immutable Decision outcome (requires human authority basis)',
		required: ['option_id', 'rationale'],
		optional: ['authority_source']
	},
	{
		name: 'defer_decision',
		target: 'decision',
		summary: 'Defer a pending Decision (requires a reason)',
		required: ['reason'],
		optional: ['until']
	},
	{
		name: 'resume_decision',
		target: 'decision',
		summary: 'Resume a deferred Decision to pending',
		required: [],
		optional: []
	},
	{
		name: 'withdraw_decision',
		target: 'decision',
		summary: 'Withdraw a pending/deferred Decision (requires a reason)',
		required: ['reason'],
		optional: []
	},
	{
		name: 'supersede_decision',
		target: 'decision',
		summary: 'Create a new pending Decision superseding a decided one',
		required: [
			'title',
			'prompt',
			'consequence_of_no_decision',
			'deciders',
			'options',
			'recommendation'
		],
		optional: ['context', 'stakes', 'needed_by']
	},
	// Finding
	{
		name: 'create_finding',
		target: null,
		summary: 'Record a durable evidence-backed conclusion (sources required)',
		required: ['title', 'conclusion', 'confidence', 'source_refs'],
		optional: ['significance', 'targets', 'observed_at', 'area_id']
	},
	{
		name: 'supersede_finding',
		target: 'finding',
		summary: 'Replace a Finding with a corrected one (history preserved)',
		required: ['title', 'conclusion', 'confidence', 'source_refs'],
		optional: ['significance', 'targets', 'observed_at', 'area_id']
	},
	{
		name: 'retract_finding',
		target: 'finding',
		summary: 'Retract a Finding (requires reason; corrective sources when applicable)',
		required: ['reason'],
		optional: ['source_refs']
	},
	// Plan
	{
		name: 'create_plan',
		target: null,
		summary: 'Create a Plan (draft revision 1) attached to a piece of Work',
		required: ['work_item_id', 'title', 'steps'],
		optional: ['summary', 'assumptions', 'risks', 'out_of_scope', 'validation_checks']
	},
	{
		name: 'update_plan',
		target: 'plan',
		summary: 'Edit the draft revision in place (drafts only \u2014 submitted Plans are immutable)',
		required: [],
		optional: [
			'title',
			'summary',
			'steps',
			'assumptions',
			'risks',
			'out_of_scope',
			'validation_checks'
		]
	},
	{
		name: 'submit_plan',
		target: 'plan',
		summary:
			'Submit the draft revision (immutable from now; supersedes the prior submitted revision)',
		required: [],
		optional: []
	},
	{
		name: 'revise_plan',
		target: 'plan',
		summary: 'Create a linked draft replacement for the submitted revision',
		required: [],
		optional: ['summary', 'steps', 'assumptions', 'risks', 'out_of_scope', 'validation_checks']
	},
	{
		name: 'withdraw_plan',
		target: 'plan',
		summary: 'Withdraw the current Plan revision (requires a reason)',
		required: ['reason'],
		optional: []
	},
	// Review
	{
		name: 'create_review',
		target: null,
		summary: 'Record an immutable Review of an exact subject revision',
		required: ['subject_id', 'subject_revision', 'outcome', 'summary'],
		optional: ['comments', 'source_refs']
	},
	// Change Request + Authorization
	{
		name: 'create_change',
		target: null,
		summary: 'Create a Change Request with its complete authority-ready package and Plan',
		required: [
			'area_id',
			'title',
			'scope_allowed',
			'targets',
			'risk',
			'acceptance_criteria',
			'plan'
		],
		optional: ['summary', 'scope_prohibited', 'safety']
	},
	{
		name: 'revise_change',
		target: 'change_request',
		summary: 'Replace the authority-ready package (invalidates pinned Authorization)',
		required: ['scope_allowed', 'targets', 'risk', 'acceptance_criteria'],
		optional: ['scope_prohibited', 'safety']
	},
	{
		name: 'authorize_change',
		target: 'change_request',
		summary: 'Grant Authorization pinned to the exact Change + Plan revisions and scope',
		required: [],
		optional: ['conditions', 'expires_at', 'one_time', 'authority_source', 'source_refs']
	},
	{
		name: 'revoke_authorization',
		target: 'authorization',
		summary: 'Revoke an Authorization (requires reason and human authority basis)',
		required: ['reason'],
		optional: ['authority_source']
	},
	{
		name: 'start_change',
		target: 'change_request',
		summary: 'Begin controlled execution (requires valid Authorization, unblocked)',
		required: [],
		optional: []
	},
	{
		name: 'pause_change',
		target: 'change_request',
		summary: 'Pause execution deliberately',
		required: [],
		optional: []
	},
	{
		name: 'resume_change',
		target: 'change_request',
		summary: 'Resume paused execution (authorization rechecked)',
		required: [],
		optional: []
	},
	{
		name: 'succeed_execution',
		target: 'change_request',
		summary: 'Record successful execution (requires result summary; consumes one-time authority)',
		required: ['result_summary'],
		optional: []
	},
	{
		name: 'fail_execution',
		target: 'change_request',
		summary: 'Record execution failure (requires failure summary)',
		required: ['failure_summary'],
		optional: []
	},
	{
		name: 'retry_change',
		target: 'change_request',
		summary: 'Retry failed execution (legal only inside current Authorization)',
		required: [],
		optional: []
	},
	{
		name: 'cancel_change',
		target: 'change_request',
		summary: 'Cancel the Change (requires a reason; preserves history)',
		required: ['reason'],
		optional: []
	},
	{
		name: 'start_verification',
		target: 'change_request',
		summary: 'Begin verifying acceptance criteria (execution must have succeeded)',
		required: [],
		optional: []
	},
	{
		name: 'pass_verification',
		target: 'change_request',
		summary: 'Pass verification (every criterion satisfied with sources, or waived)',
		required: [],
		optional: ['criteria_evidence']
	},
	{
		name: 'fail_verification',
		target: 'change_request',
		summary: 'Fail verification (requires summary of what failed)',
		required: ['summary'],
		optional: []
	},
	{
		name: 'waive_verification',
		target: 'change_request',
		summary: 'Waive verification with authority and rationale (authority-creating)',
		required: ['reason'],
		optional: ['authority_source']
	},
	{
		name: 'start_rollback',
		target: 'change_request',
		summary: 'Begin rolling back an executed Change (history preserved)',
		required: [],
		optional: []
	},
	{
		name: 'complete_rollback',
		target: 'change_request',
		summary: 'Record completed rollback (execution becomes rolled_back)',
		required: ['summary'],
		optional: []
	},
	// Project
	{
		name: 'create_project',
		target: null,
		summary: 'Create a Project (bounded outcome with an explicit finish line) as draft',
		required: ['title', 'area_id'],
		optional: [
			'summary',
			'desired_outcome',
			'why_it_matters',
			'scope_included',
			'scope_excluded',
			'completion_criteria',
			'owner',
			'target_at',
			'parallel_phases_allowed'
		]
	},
	{
		name: 'update_project',
		target: 'project',
		summary: 'Edit Project definition fields (never lifecycle)',
		required: [],
		optional: [
			'title',
			'summary',
			'desired_outcome',
			'why_it_matters',
			'scope_included',
			'scope_excluded',
			'completion_criteria',
			'owner',
			'target_at'
		]
	},
	{
		name: 'plan_project',
		target: 'project',
		summary: 'Move a draft Project to planned (outcome, scope, owner, criteria required)',
		required: [],
		optional: []
	},
	{
		name: 'activate_project',
		target: 'project',
		summary:
			'Activate a planned/paused Project (needs a submitted Plan or plan_not_required reason)',
		required: [],
		optional: ['plan_not_required_reason']
	},
	{
		name: 'pause_project',
		target: 'project',
		summary: 'Pause an active Project deliberately',
		required: [],
		optional: []
	},
	{
		name: 'complete_project',
		target: 'project',
		summary:
			'Complete a Project (all criteria satisfied/waived, next item cleared, outcome summary)',
		required: ['outcome_summary'],
		optional: []
	},
	{
		name: 'cancel_project',
		target: 'project',
		summary: 'Cancel a Project (requires reason and disposition of active child Work)',
		required: ['reason', 'child_disposition'],
		optional: []
	},
	{
		name: 'reopen_project',
		target: 'project',
		summary: 'Reopen a terminal Project to active (reason + new current next item)',
		required: ['reason', 'current_next_item_id'],
		optional: []
	},
	{
		name: 'archive_project',
		target: 'project',
		summary: 'Archive a Project (visibility only; lifecycle outcome preserved)',
		required: [],
		optional: []
	},
	{
		name: 'restore_project',
		target: 'project',
		summary: 'Clear a Project archive flag',
		required: [],
		optional: []
	},
	{
		name: 'set_current_next_item',
		target: 'project',
		summary: 'Point the Project at its authoritative current next item (or clear it)',
		required: [],
		optional: ['item_id']
	},
	{
		name: 'waive_completion_criterion',
		target: 'project',
		summary: 'Waive a completion criterion (authority-creating; requires reason)',
		required: ['criterion_id', 'reason'],
		optional: ['authority_source']
	},
	{
		name: 'set_project_health_override',
		target: 'project',
		summary: 'Override derived health (requires reason and expiry) or clear the override',
		required: [],
		optional: ['health', 'reason', 'expires_at', 'clear']
	},
	// Phase
	{
		name: 'create_phase',
		target: null,
		summary: 'Create a Phase (ordered project-local planning section)',
		required: ['project_id', 'title'],
		optional: ['summary', 'sequence', 'target_at']
	},
	{
		name: 'activate_phase',
		target: 'phase',
		summary:
			'Activate a Phase (completes/parallels the previously active one; empty Phases cannot activate)',
		required: [],
		optional: ['parallel']
	},
	{
		name: 'complete_phase',
		target: 'phase',
		summary: 'Complete a Phase (all required Phase Work must be terminal)',
		required: [],
		optional: []
	},
	{
		name: 'skip_phase',
		target: 'phase',
		summary: 'Skip a Phase (requires reason and disposition of unfinished Work)',
		required: ['reason'],
		optional: ['work_disposition']
	},
	{
		name: 'reopen_phase',
		target: 'phase',
		summary: 'Reopen a completed/skipped Phase (requires a reason)',
		required: ['reason'],
		optional: []
	},
	// Milestone
	{
		name: 'create_milestone',
		target: null,
		summary: 'Create a Milestone (zero-duration checkpoint with an observable success condition)',
		required: ['project_id', 'title', 'success_condition'],
		optional: ['summary', 'sequence', 'target_at']
	},
	{
		name: 'achieve_milestone',
		target: 'milestone',
		summary: 'Achieve a Milestone (source references required unless explicitly waived)',
		required: [],
		optional: ['source_refs', 'waive_sources_reason']
	},
	{
		name: 'cancel_milestone',
		target: 'milestone',
		summary: 'Cancel a Milestone (requires a reason)',
		required: ['reason'],
		optional: []
	},
	{
		name: 'reopen_milestone',
		target: 'milestone',
		summary: 'Reopen an achieved/cancelled Milestone (requires a reason)',
		required: ['reason'],
		optional: []
	},
	// Relationships
	{
		name: 'link_work',
		target: null,
		summary: 'Create a typed semantic link (duplicates are idempotent no-ops)',
		required: ['rel_type', 'source_id', 'target_id'],
		optional: ['criterion_id', 'source_refs']
	},
	{
		name: 'unlink_work',
		target: null,
		summary: 'Remove a semantic link (audited; history preserved)',
		required: ['link_id'],
		optional: ['reason']
	},
	{
		name: 'assign_to_project',
		target: null,
		summary: 'Assign Work to a Project (and optionally a Phase in that Project), or unassign',
		required: ['work_id'],
		optional: ['project_id', 'phase_id']
	}
];
function commandMeta(name) {
	return WORK3_COMMANDS.find((command) => command.name === name);
}

// src/lib/work3-shared/ids.ts
var WORK3_TYPE_PREFIXES = {
	area: 'a',
	task: 't',
	question: 'q',
	decision: 'd',
	change_request: 'c',
	project: 'p',
	phase: 'ph',
	milestone: 'm',
	plan: 'pl',
	finding: 'f',
	review: 'rv',
	authorization: 'az',
	blocker: 'b'
};
var PREFIX_TO_TYPE = new Map(
	Object.entries(WORK3_TYPE_PREFIXES).map(([type, prefix]) => [prefix, type])
);
var PUBLIC_ID_PATTERN = /^([a-z]+)([1-9][0-9]*)$/;
function parsePublicId(id) {
	const match = PUBLIC_ID_PATTERN.exec(id);
	if (!match) return null;
	const type = PREFIX_TO_TYPE.get(match[1]);
	if (!type) return null;
	return { type, seq: Number(match[2]) };
}

// src/cli/flags.ts
var OUTPUT_FLAGS = {
	json: 'boolean',
	full: 'boolean',
	fields: 'string'
};
function toSnake(flag) {
	return flag.replaceAll('-', '_');
}
function parseArgs(args, spec) {
	const merged = { ...OUTPUT_FLAGS, ...spec };
	const positional = [];
	const flags = {};
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (!arg.startsWith('--')) {
			positional.push(arg);
			continue;
		}
		const body = arg.slice(2);
		const equals = body.indexOf('=');
		const rawName = equals === -1 ? body : body.slice(0, equals);
		const name = toSnake(rawName);
		const kind = merged[name];
		if (!kind) {
			throw new CliError('usage', `Unknown flag: --${rawName}`, {
				suggestions: Object.keys(merged).map((known) => `--${known.replaceAll('_', '-')}`)
			});
		}
		let value;
		if (equals !== -1) {
			value = body.slice(equals + 1);
		} else if (kind !== 'boolean') {
			value = args[i + 1];
			if (value === void 0 || value.startsWith('--')) {
				throw new CliError('usage', `Flag --${rawName} requires a value`);
			}
			i++;
		}
		if (kind === 'boolean') {
			flags[name] = value === void 0 ? true : value === 'true';
		} else if (kind === 'number') {
			const parsed = Number(value);
			if (!Number.isFinite(parsed)) {
				throw new CliError('usage', `Flag --${rawName} must be a number`);
			}
			flags[name] = parsed;
		} else {
			flags[name] = value;
		}
	}
	return { positional, flags };
}

// node_modules/@toon-format/toon/dist/index.mjs
var NULL_LITERAL2 = 'null';
var DELIMITERS2 = {
	comma: ',',
	tab: '	',
	pipe: '|'
};
var DEFAULT_DELIMITER2 = DELIMITERS2.comma;
function escapeString2(value) {
	return value
		.replace(/\\/g, `\\\\`)
		.replace(/"/g, `\\"`)
		.replace(/\n/g, `\\n`)
		.replace(/\r/g, `\\r`)
		.replace(/\t/g, `\\t`)
		.replace(/[\u0000-\u001F]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
function isBooleanOrNullLiteral2(token) {
	return token === 'true' || token === 'false' || token === 'null';
}
function setOwnProperty2(target, key, value) {
	if (key === '__proto__') {
		Object.defineProperty(target, key, {
			value,
			enumerable: true,
			writable: true,
			configurable: true
		});
		return;
	}
	target[key] = value;
}
function normalizeValue2(value) {
	if (value === null) return null;
	if (
		typeof value === 'object' &&
		value !== null &&
		'toJSON' in value &&
		typeof value.toJSON === 'function'
	) {
		const next = value.toJSON();
		if (next !== value) return normalizeValue2(next);
	}
	if (typeof value === 'string' || typeof value === 'boolean') return value;
	if (typeof value === 'number') {
		if (Object.is(value, -0)) return 0;
		if (!Number.isFinite(value)) return null;
		return value;
	}
	if (typeof value === 'bigint') {
		if (value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER) return Number(value);
		return value.toString();
	}
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) return value.map(normalizeValue2);
	if (value instanceof Set) return Array.from(value).map(normalizeValue2);
	if (value instanceof Map)
		return Object.fromEntries(Array.from(value, ([k, v]) => [String(k), normalizeValue2(v)]));
	if (isPlainObject2(value)) {
		const encodedValues = {};
		for (const key in value)
			if (Object.hasOwn(value, key))
				setOwnProperty2(encodedValues, key, normalizeValue2(value[key]));
		return encodedValues;
	}
	return null;
}
function isJsonPrimitive2(value) {
	return (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	);
}
function isJsonArray2(value) {
	return Array.isArray(value);
}
function isJsonObject2(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isEmptyObject2(value) {
	return Object.keys(value).length === 0;
}
function isPlainObject2(value) {
	if (value === null || typeof value !== 'object') return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === null || prototype === Object.prototype;
}
function isArrayOfPrimitives2(value) {
	return value.length === 0 || value.every((item) => isJsonPrimitive2(item));
}
function isArrayOfArrays2(value) {
	return value.length === 0 || value.every((item) => isJsonArray2(item));
}
function isArrayOfObjects2(value) {
	return value.length === 0 || value.every((item) => isJsonObject2(item));
}
var NUMERIC_LIKE_PATTERN2 = /^[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i;
var LEADING_ZERO_PATTERN2 = /^0\d+$/;
function isValidUnquotedKey2(key) {
	return /^[A-Z_][\w.]*$/i.test(key);
}
function isSafeUnquoted2(value, delimiter = DEFAULT_DELIMITER2) {
	if (!value) return false;
	if (value !== value.trim()) return false;
	if (isBooleanOrNullLiteral2(value) || isNumericLike2(value)) return false;
	if (value.includes(':')) return false;
	if (value.includes('"') || value.includes('\\')) return false;
	if (/[[\]{}]/.test(value)) return false;
	if (/[\u0000-\u001F]/.test(value)) return false;
	if (value.includes(delimiter)) return false;
	if (value.startsWith('-')) return false;
	if (value.startsWith('#')) return false;
	return true;
}
function isNumericLike2(value) {
	return NUMERIC_LIKE_PATTERN2.test(value) || LEADING_ZERO_PATTERN2.test(value);
}
function encodePrimitive2(value, delimiter) {
	if (value === null) return NULL_LITERAL2;
	if (typeof value === 'boolean') return String(value);
	if (typeof value === 'number') return String(value);
	return encodeStringLiteral2(value, delimiter);
}
function encodeStringLiteral2(value, delimiter = DEFAULT_DELIMITER2) {
	if (isSafeUnquoted2(value, delimiter)) return value;
	return `"${escapeString2(value)}"`;
}
function encodeKey2(key) {
	if (isValidUnquotedKey2(key)) return key;
	return `"${escapeString2(key)}"`;
}
function encodeAndJoinPrimitives2(values, delimiter = DEFAULT_DELIMITER2) {
	return values.map((v) => encodePrimitive2(v, delimiter)).join(delimiter);
}
function formatHeader2(length, options) {
	const key = options?.key;
	const fields = options?.fields;
	const delimiter = options?.delimiter ?? ',';
	let header = '';
	if (key != null) header += encodeKey2(key);
	header += `[${length}${options?.keyed ? ':' : ''}${delimiter !== DEFAULT_DELIMITER2 ? delimiter : ''}]`;
	if (fields) header += `{${formatFieldSegment(fields, delimiter)}}`;
	header += ':';
	return header;
}
function formatFieldSegment(fields, delimiter) {
	return fields
		.map(
			(field) =>
				encodeKey2(field.name) +
				(field.children ? `{${formatFieldSegment(field.children, delimiter)}}` : '')
		)
		.join(delimiter);
}
function* encodeJsonValue2(value, options, depth) {
	if (isJsonPrimitive2(value)) {
		const encodedPrimitive = encodePrimitive2(value, options.delimiter);
		if (encodedPrimitive !== '') yield encodedPrimitive;
		return;
	}
	if (isJsonArray2(value)) yield* encodeArrayLines2(void 0, value, depth, options);
	else if (isJsonObject2(value)) {
		const keyedFields = extractKeyedFields(value);
		if (keyedFields) {
			yield* encodeKeyedObjectLines(void 0, value, keyedFields, depth, options);
			return;
		}
		yield* encodeObjectLines2(value, depth, options);
	}
}
function* encodeObjectLines2(value, depth, options) {
	for (const [key, val] of Object.entries(value))
		yield* encodeKeyValuePairLines2(key, val, depth, options);
}
function* encodeKeyValuePairLines2(key, value, depth, options) {
	const encodedKey = encodeKey2(key);
	if (isJsonPrimitive2(value))
		yield indentedLine2(
			depth,
			`${encodedKey}: ${encodePrimitive2(value, options.delimiter)}`,
			options.indent
		);
	else if (isJsonArray2(value)) yield* encodeArrayLines2(key, value, depth, options);
	else if (isJsonObject2(value)) {
		const keyedFields = extractKeyedFields(value);
		if (keyedFields) {
			yield* encodeKeyedObjectLines(key, value, keyedFields, depth, options);
			return;
		}
		yield indentedLine2(depth, `${encodedKey}:`, options.indent);
		if (!isEmptyObject2(value)) yield* encodeObjectLines2(value, depth + 1, options);
	}
}
function extractKeyedFields(value) {
	const entryValues = Object.values(value);
	if (entryValues.length < 2) return;
	if (!entryValues.every((entryValue) => isJsonObject2(entryValue) && !isEmptyObject2(entryValue)))
		return;
	return extractTabularHeader2(entryValues);
}
function* encodeKeyedObjectLines(key, value, fields, depth, options) {
	const entries = Object.entries(value);
	yield indentedLine2(
		depth,
		formatHeader2(entries.length, {
			key,
			fields,
			delimiter: options.delimiter,
			keyed: true
		}),
		options.indent
	);
	yield* encodeKeyedEntryRowsLines(entries, fields, depth + 1, options);
}
function* encodeKeyedEntryRowsLines(entries, fields, depth, options) {
	for (const [entryKey, entryValue] of entries) {
		const leaves = [];
		collectLeafValues(entryValue, fields, leaves);
		yield indentedLine2(
			depth,
			`${encodeKey2(entryKey)}: ${encodeAndJoinPrimitives2(leaves, options.delimiter)}`,
			options.indent
		);
	}
}
function* encodeArrayLines2(key, value, depth, options) {
	if (value.length === 0) {
		yield indentedLine2(depth, key != null ? `${encodeKey2(key)}: []` : '[]', options.indent);
		return;
	}
	if (isArrayOfPrimitives2(value)) {
		yield indentedLine2(
			depth,
			encodeInlineArrayLine2(value, options.delimiter, key),
			options.indent
		);
		return;
	}
	if (isArrayOfArrays2(value)) {
		if (value.every((arr) => isArrayOfPrimitives2(arr))) {
			yield* encodeArrayOfArraysAsListItemsLines2(key, value, depth, options);
			return;
		}
	}
	if (isArrayOfObjects2(value)) {
		const header = extractTabularHeader2(value);
		if (header) yield* encodeArrayOfObjectsAsTabularLines2(key, value, header, depth, options);
		else yield* encodeMixedArrayAsListItemsLines2(key, value, depth, options);
		return;
	}
	yield* encodeMixedArrayAsListItemsLines2(key, value, depth, options);
}
function* encodeArrayOfArraysAsListItemsLines2(prefix, values, depth, options) {
	yield indentedLine2(
		depth,
		formatHeader2(values.length, {
			key: prefix,
			delimiter: options.delimiter
		}),
		options.indent
	);
	for (const arr of values)
		if (isArrayOfPrimitives2(arr)) {
			const arrayLine = encodeInlineArrayLine2(arr, options.delimiter);
			yield indentedListItem2(depth + 1, arrayLine, options.indent);
		}
}
function encodeInlineArrayLine2(values, delimiter, prefix) {
	const header = formatHeader2(values.length, {
		key: prefix,
		delimiter
	});
	const joinedValue = encodeAndJoinPrimitives2(values, delimiter);
	if (values.length === 0) return header;
	return `${header} ${joinedValue}`;
}
function* encodeArrayOfObjectsAsTabularLines2(prefix, rows, header, depth, options) {
	yield indentedLine2(
		depth,
		formatHeader2(rows.length, {
			key: prefix,
			fields: header,
			delimiter: options.delimiter
		}),
		options.indent
	);
	yield* writeTabularRowsLines2(rows, header, depth + 1, options);
}
function extractTabularHeader2(rows) {
	if (rows.length === 0) return;
	const firstKeys = Object.keys(rows[0]);
	if (firstKeys.length === 0) return;
	for (const row of rows) {
		if (Object.keys(row).length !== firstKeys.length) return;
		for (const key of firstKeys) if (!Object.hasOwn(row, key)) return;
	}
	const fieldNodes = [];
	for (const key of firstKeys) {
		const fieldNode = classifyColumn(
			key,
			rows.map((row) => row[key])
		);
		if (!fieldNode) return;
		fieldNodes.push(fieldNode);
	}
	return fieldNodes;
}
function classifyColumn(name, values) {
	if (values.every((value) => isJsonPrimitive2(value))) return { name };
	if (!values.every((value) => isJsonObject2(value) && !isEmptyObject2(value))) return;
	const children = extractTabularHeader2(values);
	if (!children) return;
	return {
		name,
		children
	};
}
function collectLeafValues(row, fields, leaves) {
	for (const field of fields) {
		const value = row[field.name];
		if (field.children) collectLeafValues(value, field.children, leaves);
		else leaves.push(value);
	}
}
function* writeTabularRowsLines2(rows, header, depth, options) {
	for (const row of rows) {
		const leaves = [];
		collectLeafValues(row, header, leaves);
		yield indentedLine2(depth, encodeAndJoinPrimitives2(leaves, options.delimiter), options.indent);
	}
}
function* encodeMixedArrayAsListItemsLines2(prefix, items, depth, options) {
	yield indentedLine2(
		depth,
		formatHeader2(items.length, {
			key: prefix,
			delimiter: options.delimiter
		}),
		options.indent
	);
	for (const item of items) yield* encodeListItemValueLines2(item, depth + 1, options);
}
function* encodeObjectAsListItemLines2(obj, depth, options) {
	if (isEmptyObject2(obj)) {
		yield indentedLine2(depth, '-', options.indent);
		return;
	}
	const entries = Object.entries(obj);
	const [firstKey, firstValue] = entries[0];
	const restEntries = entries.slice(1);
	if (isJsonArray2(firstValue) && isArrayOfObjects2(firstValue)) {
		const header = extractTabularHeader2(firstValue);
		if (header) {
			yield indentedListItem2(
				depth,
				formatHeader2(firstValue.length, {
					key: firstKey,
					fields: header,
					delimiter: options.delimiter
				}),
				options.indent
			);
			yield* writeTabularRowsLines2(firstValue, header, depth + 2, options);
			if (restEntries.length > 0)
				yield* encodeObjectLines2(Object.fromEntries(restEntries), depth + 1, options);
			return;
		}
	}
	if (isJsonObject2(firstValue)) {
		const keyedFields = extractKeyedFields(firstValue);
		if (keyedFields) {
			const keyedEntries = Object.entries(firstValue);
			yield indentedListItem2(
				depth,
				formatHeader2(keyedEntries.length, {
					key: firstKey,
					fields: keyedFields,
					delimiter: options.delimiter,
					keyed: true
				}),
				options.indent
			);
			yield* encodeKeyedEntryRowsLines(keyedEntries, keyedFields, depth + 2, options);
			if (restEntries.length > 0)
				yield* encodeObjectLines2(Object.fromEntries(restEntries), depth + 1, options);
			return;
		}
	}
	const encodedKey = encodeKey2(firstKey);
	if (isJsonPrimitive2(firstValue))
		yield indentedListItem2(
			depth,
			`${encodedKey}: ${encodePrimitive2(firstValue, options.delimiter)}`,
			options.indent
		);
	else if (isJsonArray2(firstValue))
		if (firstValue.length === 0)
			yield indentedListItem2(depth, `${encodedKey}: []`, options.indent);
		else if (isArrayOfPrimitives2(firstValue))
			yield indentedListItem2(
				depth,
				`${encodedKey}${encodeInlineArrayLine2(firstValue, options.delimiter)}`,
				options.indent
			);
		else {
			yield indentedListItem2(
				depth,
				`${encodedKey}${formatHeader2(firstValue.length, { delimiter: options.delimiter })}`,
				options.indent
			);
			for (const item of firstValue) yield* encodeListItemValueLines2(item, depth + 2, options);
		}
	else if (isJsonObject2(firstValue)) {
		yield indentedListItem2(depth, `${encodedKey}:`, options.indent);
		if (!isEmptyObject2(firstValue)) yield* encodeObjectLines2(firstValue, depth + 2, options);
	}
	if (restEntries.length > 0)
		yield* encodeObjectLines2(Object.fromEntries(restEntries), depth + 1, options);
}
function* encodeListItemValueLines2(value, depth, options) {
	if (isJsonPrimitive2(value))
		yield indentedListItem2(depth, encodePrimitive2(value, options.delimiter), options.indent);
	else if (isJsonArray2(value))
		if (isArrayOfPrimitives2(value))
			yield indentedListItem2(
				depth,
				encodeInlineArrayLine2(value, options.delimiter),
				options.indent
			);
		else {
			yield indentedListItem2(
				depth,
				formatHeader2(value.length, { delimiter: options.delimiter }),
				options.indent
			);
			for (const item of value) yield* encodeListItemValueLines2(item, depth + 1, options);
		}
	else if (isJsonObject2(value)) yield* encodeObjectAsListItemLines2(value, depth, options);
}
function indentedLine2(depth, content, indentSize) {
	return ' '.repeat(indentSize * depth) + content;
}
function indentedListItem2(depth, content, indentSize) {
	return indentedLine2(depth, '- ' + content, indentSize);
}
function applyReplacer2(root, replacer) {
	const replacedRoot = replacer('', root, []);
	if (replacedRoot === void 0) return transformChildren2(root, replacer, []);
	return transformChildren2(normalizeValue2(replacedRoot), replacer, []);
}
function transformChildren2(value, replacer, path) {
	if (isJsonObject2(value)) return transformObject2(value, replacer, path);
	if (isJsonArray2(value)) return transformArray2(value, replacer, path);
	return value;
}
function transformObject2(obj, replacer, path) {
	const result = {};
	for (const [key, value] of Object.entries(obj)) {
		const childPath = [...path, key];
		const replacedValue = replacer(key, value, childPath);
		if (replacedValue === void 0) continue;
		setOwnProperty2(
			result,
			key,
			transformChildren2(normalizeValue2(replacedValue), replacer, childPath)
		);
	}
	return result;
}
function transformArray2(arr, replacer, path) {
	const result = [];
	for (let i = 0; i < arr.length; i++) {
		const value = arr[i];
		const childPath = [...path, i];
		const replacedValue = replacer(String(i), value, childPath);
		if (replacedValue === void 0) continue;
		const normalizedValue = normalizeValue2(replacedValue);
		result.push(transformChildren2(normalizedValue, replacer, childPath));
	}
	return result;
}
function encode2(input, options) {
	return Array.from(encodeLines2(input, options)).join('\n');
}
function encodeLines2(input, options) {
	const normalizedValue = normalizeValue2(input);
	const resolvedOptions = resolveOptions2(options);
	return encodeJsonValue2(
		resolvedOptions.replacer
			? applyReplacer2(normalizedValue, resolvedOptions.replacer)
			: normalizedValue,
		resolvedOptions,
		0
	);
}
function resolveOptions2(options) {
	return {
		indent: options?.indent ?? 2,
		delimiter: options?.delimiter ?? DEFAULT_DELIMITER2,
		replacer: options?.replacer
	};
}

// src/cli/render.ts
var TRUNCATE_AT = 500;
function projectItem(item, fields) {
	if (!fields || fields.length === 0) return item;
	const projected = {};
	for (const field of ['id', ...fields]) {
		if (field in item) projected[field] = item[field];
	}
	return projected;
}
function truncateStrings(value, path, notes) {
	if (typeof value === 'string' && value.length > TRUNCATE_AT) {
		notes.push({ field: path, original_chars: value.length, shown_chars: TRUNCATE_AT });
		return value.slice(0, TRUNCATE_AT) + '\u2026';
	}
	if (Array.isArray(value)) {
		return value.map((entry, index) => truncateStrings(entry, `${path}[${index}]`, notes));
	}
	if (value !== null && typeof value === 'object') {
		const out = {};
		for (const [key, entry] of Object.entries(value)) {
			out[key] = truncateStrings(entry, path ? `${path}.${key}` : key, notes);
		}
		return out;
	}
	return value;
}
function preparePayload(payload, options) {
	let prepared = payload;
	if (options.fields?.length) {
		if (Array.isArray(prepared.items)) {
			prepared = {
				...prepared,
				items: prepared.items.map((item) => projectItem(item, options.fields))
			};
		} else {
			prepared = projectItem(prepared, options.fields);
		}
	}
	if (!options.full) {
		const notes = [];
		prepared = truncateStrings(prepared, '', notes);
		if (notes.length > 0) {
			prepared = {
				...prepared,
				truncated: notes,
				...(options.fullCommand ? { full_content: `Run \`${options.fullCommand}\`` } : {})
			};
		}
	}
	return prepared;
}
function render(payload, options = {}) {
	const prepared = preparePayload(payload, options);
	if (options.json) return JSON.stringify(prepared, null, 2);
	return encode2(prepared);
}

// src/cli/nouns.ts
var NUMBER_FIELDS = /* @__PURE__ */ new Set([
	'sequence',
	'due_at',
	'follow_up_at',
	'target_at',
	'needed_by',
	'until',
	'observed_at'
]);
var JSON_FIELDS = /* @__PURE__ */ new Set([
	'options',
	'deciders',
	'recommendation',
	'answerable_by',
	'working_hypothesis',
	'source_refs',
	'targets',
	'authority_source',
	'steps',
	'plan',
	'conditions',
	'criteria_evidence',
	'comments',
	'scope_allowed',
	'scope_prohibited',
	'risk',
	'safety',
	'acceptance_criteria',
	'one_time',
	'scope_included',
	'scope_excluded',
	'completion_criteria',
	'parallel_phases_allowed',
	'parallel',
	'clear'
]);
var NOUN_VERBS = {
	area: {
		create: 'create_area',
		update: 'update_area',
		archive: 'archive_area',
		restore: 'restore_area'
	},
	task: {
		create: 'create_task',
		update: 'update_task',
		ready: 'ready_task',
		start: 'start_task',
		wait: 'wait_task',
		resume: 'resume_task',
		submit: 'submit_task_for_review',
		accept: 'accept_task',
		complete: 'complete_task',
		cancel: 'cancel_task',
		reopen: 'reopen_task'
	},
	blocker: {
		create: 'create_blocker',
		resolve: 'resolve_blocker',
		invalidate: 'invalidate_blocker'
	},
	question: {
		create: 'create_question',
		update: 'update_question',
		answer: 'answer_question',
		'revise-answer': 'revise_answer',
		withdraw: 'withdraw_question',
		reopen: 'reopen_question'
	},
	decision: {
		create: 'create_decision',
		revise: 'revise_decision',
		decide: 'decide',
		defer: 'defer_decision',
		resume: 'resume_decision',
		withdraw: 'withdraw_decision',
		supersede: 'supersede_decision'
	},
	finding: {
		create: 'create_finding',
		supersede: 'supersede_finding',
		retract: 'retract_finding'
	},
	plan: {
		create: 'create_plan',
		update: 'update_plan',
		submit: 'submit_plan',
		revise: 'revise_plan',
		withdraw: 'withdraw_plan'
	},
	review: {
		create: 'create_review'
	},
	authorization: {
		revoke: 'revoke_authorization'
	},
	project: {
		create: 'create_project',
		update: 'update_project',
		plan: 'plan_project',
		activate: 'activate_project',
		pause: 'pause_project',
		complete: 'complete_project',
		cancel: 'cancel_project',
		reopen: 'reopen_project',
		archive: 'archive_project',
		restore: 'restore_project',
		'set-next': 'set_current_next_item',
		'waive-criterion': 'waive_completion_criterion',
		'health-override': 'set_project_health_override'
	},
	phase: {
		create: 'create_phase',
		activate: 'activate_phase',
		complete: 'complete_phase',
		skip: 'skip_phase',
		reopen: 'reopen_phase'
	},
	milestone: {
		create: 'create_milestone',
		achieve: 'achieve_milestone',
		cancel: 'cancel_milestone',
		reopen: 'reopen_milestone'
	},
	link: {
		create: 'link_work',
		remove: 'unlink_work',
		assign: 'assign_to_project'
	},
	change: {
		create: 'create_change',
		revise: 'revise_change',
		authorize: 'authorize_change',
		start: 'start_change',
		pause: 'pause_change',
		resume: 'resume_change',
		succeed: 'succeed_execution',
		fail: 'fail_execution',
		retry: 'retry_change',
		cancel: 'cancel_change',
		'start-verification': 'start_verification',
		'pass-verification': 'pass_verification',
		'fail-verification': 'fail_verification',
		'waive-verification': 'waive_verification',
		'start-rollback': 'start_rollback',
		'complete-rollback': 'complete_rollback'
	}
};
var LIST_FILTERS = {
	task: ['status', 'area', 'owner', 'priority', 'active', 'q'],
	area: ['state'],
	blocker: ['state', 'blocked'],
	question: ['status', 'area', 'steward', 'priority'],
	decision: ['status', 'area', 'priority'],
	finding: ['validity', 'confidence', 'area', 'target'],
	plan: ['work_item'],
	review: ['subject', 'outcome'],
	authorization: ['subject'],
	change: ['execution', 'verification', 'area'],
	project: ['status', 'area', 'archived'],
	phase: ['project', 'status'],
	milestone: ['project', 'status']
};
function outputOptions(flags, fullCommand) {
	return {
		json: flags.json === true,
		full: flags.full === true,
		fields:
			typeof flags.fields === 'string' ? flags.fields.split(',').map((f) => f.trim()) : void 0,
		fullCommand
	};
}
function payloadSpec(meta) {
	const spec = { expect_version: 'number', idempotency_key: 'string' };
	for (const field of [...meta.required, ...meta.optional]) {
		spec[field] = NUMBER_FIELDS.has(field) ? 'number' : 'string';
	}
	return spec;
}
function payloadFromFlags(meta, flags) {
	const payload = {};
	for (const field of [...meta.required, ...meta.optional]) {
		if (flags[field] === void 0) continue;
		if (JSON_FIELDS.has(field)) {
			try {
				payload[field] = JSON.parse(String(flags[field]));
			} catch {
				throw new CliError('usage', `--${field.replaceAll('_', '-')} must be valid JSON`, {
					suggestions: [`Example: --${field.replaceAll('_', '-')} '["value"]'`]
				});
			}
		} else {
			payload[field] = flags[field];
		}
	}
	const missing = meta.required.filter((field) => payload[field] === void 0);
	if (missing.length > 0) {
		throw new CliError(
			'usage',
			`${meta.name} requires: ${missing.map((f) => `--${f.replaceAll('_', '-')}`).join(', ')}`
		);
	}
	return payload;
}
function nextAction(command, targetId, resultStatus) {
	if (command === 'create_task') return `falcon task ready ${targetId} --owner <owner>`;
	if (command === 'ready_task') return `falcon task start ${targetId}`;
	if (command === 'start_task') return `falcon task complete ${targetId} --result-summary "\u2026"`;
	if (command === 'submit_task_for_review') return `falcon task accept ${targetId}`;
	if (command === 'create_blocker')
		return `falcon blocker resolve ${targetId} --summary "\u2026" (when cleared)`;
	if (resultStatus === 'waiting') return `falcon task resume ${targetId}`;
	return void 0;
}
async function runVerb(noun, verb, commandName, args) {
	const meta = commandMeta(commandName);
	if (!meta) throw new CliError('internal_error', `Manifest missing ${commandName}`);
	const { positional, flags } = parseArgs(args, payloadSpec(meta));
	let target;
	let expectedVersion;
	if (meta.target) {
		target = positional[0];
		if (!target) {
			throw new CliError('usage', `Usage: falcon ${noun} ${verb} <id> [flags]`);
		}
		expectedVersion =
			typeof flags.expect_version === 'number'
				? flags.expect_version
				: await currentVersion(meta.target, target);
	}
	const payload = payloadFromFlags(meta, flags);
	const success = await apiCommand({
		command: commandName,
		target,
		expectedVersion,
		idempotencyKey: typeof flags.idempotency_key === 'string' ? flags.idempotency_key : void 0,
		payload
	});
	const result = success.result;
	const primaryEvent = success.events.find((event) => event.subject_id === (target ?? result.id));
	const output = {
		command: commandName,
		target: target ?? result.id,
		...result,
		noop: success.noop,
		...(primaryEvent
			? { prior_version: primaryEvent.version_from, version: primaryEvent.version_to }
			: {})
	};
	const next = nextAction(commandName, target ?? result.id, result.status);
	if (next) output.next = next;
	return render(output, outputOptions(flags));
}
async function runList(noun, args) {
	const spec = { limit: 'number', offset: 'number' };
	for (const filter of LIST_FILTERS[noun]) spec[filter] = 'string';
	const { flags } = parseArgs(args, spec);
	const params = new URLSearchParams();
	for (const filter of LIST_FILTERS[noun]) {
		if (flags[filter] !== void 0) params.set(filter, String(flags[filter]));
	}
	if (flags.limit !== void 0) params.set('limit', String(flags.limit));
	if (flags.offset !== void 0) params.set('offset', String(flags.offset));
	const query = params.toString();
	const data = await apiGet(`/api/v3/objects/${noun}${query ? `?${query}` : ''}`);
	return render({ total: data.total, count: data.count, items: data.items }, outputOptions(flags));
}
async function runGet(noun, args) {
	const { positional, flags } = parseArgs(args, {});
	const id = positional[0];
	if (!id) throw new CliError('usage', `Usage: falcon ${noun} get <id> [--full] [--json]`);
	const view = flags.full === true ? 'full' : 'detail';
	const data = await apiGet(`/api/v3/objects/${noun}/${id}?view=${view}`);
	return render(data.item, {
		...outputOptions(flags, `falcon ${noun} get ${id} --full`)
	});
}
function nounCommand(noun) {
	return async (args) => {
		const verb = args[0];
		if (!verb) {
			throw new CliError('usage', `Usage: falcon ${noun} <verb> \u2026`, {
				suggestions: verbListFor(noun)
			});
		}
		const rest = args.slice(1);
		if (verb === 'list' && LIST_FILTERS[noun]) return runList(noun, rest);
		if (verb === 'get' && LIST_FILTERS[noun]) return runGet(noun, rest);
		const commandName = NOUN_VERBS[noun][verb];
		if (!commandName) {
			throw new CliError('usage', `Unknown verb for ${noun}: ${verb}`, {
				suggestions: verbListFor(noun)
			});
		}
		return runVerb(noun, verb, commandName, rest);
	};
}
function verbListFor(noun) {
	return ['list', 'get', ...Object.keys(NOUN_VERBS[noun])].map((verb) => `falcon ${noun} ${verb}`);
}
async function workCommand(args) {
	const sub = args[0];
	if (sub === 'list') {
		return runList('task', args.slice(1));
	}
	if (sub === 'get') {
		const id = args[1];
		if (!id) throw new CliError('usage', 'Usage: falcon work get <id>');
		const parsed = parsePublicId(id);
		if (!parsed) {
			throw new CliError('validation_failed', `Not a recognizable Work id: ${id}`);
		}
		return runGet(parsed.type, args.slice(1));
	}
	if (sub === 'search') {
		const { positional, flags } = parseArgs(args.slice(1), { limit: 'number' });
		const query = positional.join(' ');
		if (!query) throw new CliError('usage', 'Usage: falcon work search <query>');
		const params = new URLSearchParams({ q: query, active: 'true' });
		if (flags.limit !== void 0) params.set('limit', String(flags.limit));
		const data = await apiGet(`/api/v3/objects/task?${params}`);
		return render(
			{ query, total: data.total, count: data.count, items: data.items },
			outputOptions(flags)
		);
	}
	throw new CliError('usage', 'Usage: falcon work list|get|search', {
		suggestions: [
			'falcon work list --active true',
			'falcon work get t42',
			'falcon work search "deploy"'
		]
	});
}
async function historyCommand(args) {
	const { positional, flags } = parseArgs(args, { limit: 'number', event_type: 'string' });
	const subject = positional[0];
	if (!subject)
		throw new CliError('usage', 'Usage: falcon history <id> [--limit N] [--event-type type]');
	const params = new URLSearchParams({ subject });
	if (flags.limit !== void 0) params.set('limit', String(flags.limit));
	if (flags.event_type !== void 0) params.set('event_type', String(flags.event_type));
	const data = await apiGet(`/api/v3/history?${params}`);
	const events = data.events.map((event) => ({
		at: event.occurred_at,
		event: event.event_type,
		summary: event.summary,
		actor: event.actor?.label,
		version: event.version_to
	}));
	return render({ subject, count: data.count, events }, outputOptions(flags));
}
async function sourcesCommand(args) {
	if (args[0] !== 'check') {
		throw new CliError(
			'usage',
			'Usage: falcon sources check --kind <kind> --ref <ref> [--label \u2026] [--locator \u2026]'
		);
	}
	const { flags } = parseArgs(args.slice(1), {
		kind: 'string',
		ref: 'string',
		label: 'string',
		locator: 'string'
	});
	if (!flags.kind || !flags.ref) {
		throw new CliError('usage', 'sources check requires --kind and --ref');
	}
	const body = {
		source_refs: [
			{
				kind: flags.kind,
				ref: flags.ref,
				...(flags.label ? { label: flags.label } : {}),
				...(flags.locator ? { locator: flags.locator } : {})
			}
		]
	};
	const data = await apiPost('/api/v3/sources/resolve', body);
	return render({ results: data.results }, outputOptions(flags));
}
function commandHelp(noun) {
	const lines = [`falcon ${noun} \u2014 verbs:`, '  list, get'];
	for (const [verb, commandName] of Object.entries(NOUN_VERBS[noun])) {
		const meta = commandMeta(commandName);
		const required = meta.required.map((field) => `--${field.replaceAll('_', '-')} <v>`).join(' ');
		const optional =
			meta.optional.length > 0
				? ` [--${meta.optional.map((f) => f.replaceAll('_', '-')).join('|--')}]`
				: '';
		const targetArg = meta.target ? ' <id>' : '';
		lines.push(`  ${verb}${targetArg} ${required}${optional} \u2014 ${meta.summary}`);
	}
	lines.push(
		'',
		'Output: TOON by default; --json, --fields a,b, --full. Reads: --status, --area, --q filters on list.'
	);
	return lines.join('\n');
}

// src/cli/main.ts
var TOP_LEVEL_HELP = `falcon \u2014 Falcon Dash Work for agents

Usage: falcon <command> [args] [flags]

Commands:
  work      list | get <id> | search <query>
  task      list | get | create | ready | start | wait | resume | submit | accept | complete | cancel | reopen | update
  area      list | get | create | update | archive | restore
  blocker   list | get | create | resolve | invalidate
  question  list | get | create | answer | revise-answer | withdraw | reopen | update
  decision  list | get | create | decide | defer | resume | withdraw | revise | supersede
  finding   list | get | create | supersede | retract
  plan      list | get | create | update | submit | revise | withdraw
  review    list | get | create
  change    list | get | create | authorize | start | pause | resume | succeed | fail | retry | cancel | *-verification | *-rollback
  authorization  list | get | revoke
  project   list | get | create | plan | activate | pause | complete | cancel | reopen | set-next | waive-criterion
  phase     list | get | create | activate | complete | skip | reopen
  milestone list | get | create | achieve | cancel | reopen
  link      create | remove | assign \u2014 typed relationships + project assignment
  history   <id> \u2014 Event Log timeline
  sources   check \u2014 resolve a source reference

Output flags (all commands): --json, --fields a,b, --full
Config: FALCON_DASH_URL, FALCON_DASH_TOKEN (or token file under the data dir; FALCON_AGENT_ID selects one)

Run \`falcon <command> --help\` for verb details. No-arg \`falcon\` shows current orientation.`;
async function home() {
	try {
		const actionable = await apiGet('/api/v3/objects/task?active=true&limit=6');
		const items = actionable.items.map((task) => ({
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
				'falcon task get <id> \u2014 detail with legal next actions',
				'falcon work search <query> \u2014 find Work by text',
				'falcon task create --area-id <a1> --title "\u2026" \u2014 capture new Work'
			]
		});
	} catch (error) {
		if (error instanceof CliError && error.code === 'unauthorized') {
			return render({
				error: { code: error.code, message: error.message },
				help: ['Mint a token in Falcon Dash Settings \u2192 Agent Tokens']
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
		blocker: (args) => nounCommand('blocker')(args),
		question: (args) => nounCommand('question')(args),
		decision: (args) => nounCommand('decision')(args),
		finding: (args) => nounCommand('finding')(args),
		plan: (args) => nounCommand('plan')(args),
		review: (args) => nounCommand('review')(args),
		authorization: (args) => nounCommand('authorization')(args),
		change: (args) => nounCommand('change')(args),
		project: (args) => nounCommand('project')(args),
		phase: (args) => nounCommand('phase')(args),
		milestone: (args) => nounCommand('milestone')(args),
		link: (args) => nounCommand('link')(args),
		history: (args) => historyCommand(args),
		sources: (args) => sourcesCommand(args)
	},
	getCommandHelp: (command) => {
		if (command === 'work')
			return 'falcon work list|get <id>|search <query> \u2014 cross-type reads';
		if (command === 'history')
			return 'falcon history <id> [--limit N] \u2014 Event Log timeline for one object';
		if (command === 'sources')
			return 'falcon sources check --kind <kind> --ref <ref> \u2014 resolve a source reference';
		if (
			[
				'task',
				'area',
				'blocker',
				'question',
				'decision',
				'finding',
				'plan',
				'review',
				'authorization',
				'change'
			].includes(command)
		) {
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
