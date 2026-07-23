/**
 * Falcon Dash v3 ambient context (doc 06): the gateway plugin's
 * `before_prompt_build` hook fetches the bounded `GET /api/v3/brief` and
 * prepends it to agent prompts. v3-native — no workspace markdown mirror, no
 * symlinks. Best-effort: any failure yields an empty string so prompts are
 * never blocked on the dashboard.
 *
 * Deployed copy: ~/.openclaw/extensions/falcon-dash-plugin/brief-context.js
 * (this repo file is the versioned source; copy on change and restart the
 * gateway).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CACHE_TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 1_500;

let cache = { at: 0, text: '' };

function discoverToken() {
	if (process.env.FALCON_DASH_TOKEN) return process.env.FALCON_DASH_TOKEN;
	const dataDir =
		process.env.FALCON_DASH_DATA_DIR ?? join(homedir(), '.openclaw', 'data', 'falcon-dash');
	const tokenDir = join(dataDir, 'tokens');
	if (!existsSync(tokenDir)) return null;
	const agentId = process.env.FALCON_AGENT_ID;
	if (agentId && existsSync(join(tokenDir, `${agentId}.token`))) {
		return readFileSync(join(tokenDir, `${agentId}.token`), 'utf-8').trim();
	}
	const files = readdirSync(tokenDir).filter((name) => name.endsWith('.token'));
	if (files.length >= 1) {
		return readFileSync(join(tokenDir, files[0]), 'utf-8').trim();
	}
	return null;
}

function formatBucket(label, bucket) {
	if (!bucket || bucket.total === 0) return '';
	const lines = (bucket.items ?? [])
		.map((item) => `- ${item.id}: ${item.title ?? ''}${item.why ? ` — ${item.why}` : ''}`)
		.join('\n');
	const more =
		bucket.total > (bucket.items?.length ?? 0)
			? `\n- …and ${bucket.total - bucket.items.length} more (falcon queue)`
			: '';
	return `\n**${label} (${bucket.total})**\n${lines}${more}`;
}

function formatBrief(brief) {
	const sections = [
		formatBucket('Actionable now', brief.actionable_now),
		formatBucket('Needs Fred', brief.needs_fred),
		formatBucket('Blocked risk', brief.blocked_risk),
		formatBucket('Unhealthy Automata', brief.unhealthy_automata)
	].filter((section) => section.length > 0);
	if (sections.length === 0) return '';
	return `\n\n## Falcon Dash Work (v3 brief)\n${sections.join('\n')}\n\nDeeper context: \`falcon\` (orientation), \`falcon queue\`, \`falcon work get <id>\`.`;
}

/** Returns the prepend string, or '' when the dashboard is unavailable. */
export async function buildWorkBrief() {
	if (Date.now() - cache.at < CACHE_TTL_MS) return cache.text;
	cache = { at: Date.now(), text: '' };
	try {
		const token = discoverToken();
		if (!token) return '';
		const baseUrl = (process.env.FALCON_DASH_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
		const response = await fetch(`${baseUrl}/api/v3/brief`, {
			headers: { Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
		});
		if (!response.ok) return '';
		const data = await response.json();
		cache.text = formatBrief(data.brief ?? {});
		return cache.text;
	} catch {
		return '';
	}
}
