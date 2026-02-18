export type OutputFormat = 'table' | 'json' | 'markdown';

export function formatOutput(data: unknown, format: OutputFormat): string {
	if (format === 'json') return JSON.stringify(data, null, 2);
	if (format === 'markdown') return formatMarkdown(data);
	return formatTable(data);
}

function formatTable(data: unknown): string {
	if (!Array.isArray(data) || data.length === 0) {
		if (typeof data === 'object' && data !== null) {
			return Object.entries(data as Record<string, unknown>)
				.map(([k, v]) => `${k}: ${stringify(v)}`)
				.join('\n');
		}
		return 'No results';
	}

	const rows = data as Record<string, unknown>[];
	const keys = Object.keys(rows[0]);

	const widths = keys.map((k) => Math.max(k.length, ...rows.map((r) => stringify(r[k]).length)));

	const header = keys.map((k, i) => k.padEnd(widths[i])).join(' | ');
	const sep = widths.map((w) => '-'.repeat(w)).join('-+-');
	const body = rows
		.map((r) => keys.map((k, i) => stringify(r[k]).padEnd(widths[i])).join(' | '))
		.join('\n');

	return `${header}\n${sep}\n${body}`;
}

function formatMarkdown(data: unknown): string {
	if (!Array.isArray(data) || data.length === 0) {
		if (typeof data === 'object' && data !== null) {
			return Object.entries(data as Record<string, unknown>)
				.map(([k, v]) => `**${k}:** ${stringify(v)}`)
				.join('\n');
		}
		return 'No results';
	}

	const rows = data as Record<string, unknown>[];
	const keys = Object.keys(rows[0]);
	const header = `| ${keys.join(' | ')} |`;
	const sep = `| ${keys.map(() => '---').join(' | ')} |`;
	const body = rows.map((r) => `| ${keys.map((k) => stringify(r[k])).join(' | ')} |`).join('\n');
	return `${header}\n${sep}\n${body}`;
}

function stringify(val: unknown): string {
	if (val === null || val === undefined) return '';
	if (typeof val === 'object') return JSON.stringify(val);
	return String(val);
}
