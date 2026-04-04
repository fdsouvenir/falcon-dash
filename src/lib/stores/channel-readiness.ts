import { derived, get, readonly, writable, type Readable } from 'svelte/store';
import { gatewayEvents, rpc } from '$lib/gateway-api.js';

export type ChannelId = 'discord' | 'telegram';
export type ChannelReadinessState =
	| 'not_configured'
	| 'needs_input'
	| 'misconfigured'
	| 'degraded'
	| 'ready';

export interface ChannelReadiness {
	id: ChannelId;
	label: string;
	state: ChannelReadinessState;
	summary: string;
	detail: string;
	href: string;
	ctaLabel: string;
	configured: boolean;
	running: boolean;
	error?: string;
}

interface ChannelAccountStatus {
	configured?: boolean;
	enabled?: boolean;
	running?: boolean;
	connected?: boolean;
	lastError?: string | null;
	tokenSource?: string | null;
	tokenStatus?: string | null;
	mode?: string | null;
	bot?: { username?: string };
}

interface ChannelStatusEntry {
	configured?: boolean;
	running?: boolean;
	lastError?: string | null;
	tokenSource?: string | null;
	mode?: string | null;
}

interface ChannelsStatusPayload {
	channelOrder?: string[];
	channelLabels?: Record<string, string>;
	channels?: Record<string, ChannelStatusEntry>;
	channelAccounts?: Record<string, ChannelAccountStatus[]>;
}

const CHANNEL_HREFS: Record<ChannelId, string> = {
	discord: '/channels/discord',
	telegram: '/channels/telegram'
};

const _channels = writable<Record<ChannelId, ChannelReadiness>>({
	discord: fallbackChannel('discord', 'Discord'),
	telegram: fallbackChannel('telegram', 'Telegram')
});
const _loading = writable(false);
const _lastLoadedAt = writable<number | null>(null);

let refreshPromise: Promise<void> | null = null;
let lastRefreshAt = 0;
let unsubscribeHealth: (() => void) | null = null;
let unsubscribeState: (() => void) | null = null;

export const channelReadiness: Readable<Record<ChannelId, ChannelReadiness>> = readonly(_channels);
export const channelReadinessList: Readable<ChannelReadiness[]> = derived(
	_channels,
	($channels) => [$channels.discord, $channels.telegram]
);
export const channelReadinessLoading: Readable<boolean> = readonly(_loading);
export const channelReadinessLastLoadedAt: Readable<number | null> = readonly(_lastLoadedAt);
export const aggregateChatReadiness: Readable<ChannelReadinessState> = derived(
	channelReadinessList,
	($channels) => deriveAggregateState($channels)
);
export const aggregateChatSummary: Readable<string> = derived(channelReadinessList, ($channels) => {
	const readyChannels = $channels.filter((channel) => channel.state === 'ready');
	if (readyChannels.length > 0) {
		return readyChannels.length === 1
			? `${readyChannels[0].label} ready`
			: `${readyChannels.length} channels ready`;
	}

	const bestNext = $channels.find((channel) => channel.state !== 'not_configured');
	if (bestNext) return bestNext.detail;
	return 'No chat channels configured';
});

export function deriveAggregateState(channels: ChannelReadiness[]): ChannelReadinessState {
	if (channels.some((channel) => channel.state === 'ready')) return 'ready';
	if (channels.some((channel) => channel.state === 'degraded')) return 'degraded';
	if (channels.some((channel) => channel.state === 'misconfigured')) return 'misconfigured';
	if (channels.some((channel) => channel.state === 'needs_input')) return 'needs_input';
	return 'not_configured';
}

export function startChannelReadiness(): void {
	if (!unsubscribeState) {
		unsubscribeState = gatewayEvents.state.subscribe((state) => {
			if (state === 'ready') {
				void refreshChannelReadiness(true);
			}
		});
	}

	if (!unsubscribeHealth) {
		unsubscribeHealth = gatewayEvents.on('health', () => {
			void refreshChannelReadiness();
		});
	}
}

export async function refreshChannelReadiness(force = false): Promise<void> {
	const state = get(gatewayEvents.state);
	if (state !== 'ready') return;

	const now = Date.now();
	if (!force && now - lastRefreshAt < 2500) return;
	if (refreshPromise) return refreshPromise;

	lastRefreshAt = now;
	_loading.set(true);
	refreshPromise = rpc<ChannelsStatusPayload>('channels.status', {})
		.then((payload) => {
			const labels = payload.channelLabels ?? {};
			const channels = payload.channels ?? {};
			const accounts = payload.channelAccounts ?? {};

			_channels.set({
				discord: mapChannelReadiness(
					'discord',
					labels.discord ?? 'Discord',
					channels.discord,
					accounts.discord
				),
				telegram: mapChannelReadiness(
					'telegram',
					labels.telegram ?? 'Telegram',
					channels.telegram,
					accounts.telegram
				)
			});
			_lastLoadedAt.set(Date.now());
		})
		.catch((error) => {
			console.error('[channel-readiness] Failed to refresh channel status:', error);
		})
		.finally(() => {
			_loading.set(false);
			refreshPromise = null;
		});

	return refreshPromise;
}

function fallbackChannel(id: ChannelId, label: string): ChannelReadiness {
	return {
		id,
		label,
		state: 'not_configured',
		summary: 'Not configured',
		detail: `Set up ${label}`,
		href: CHANNEL_HREFS[id],
		ctaLabel: 'Set up',
		configured: false,
		running: false
	};
}

export function mapChannelReadiness(
	id: ChannelId,
	label: string,
	channel: ChannelStatusEntry | undefined,
	accounts: ChannelAccountStatus[] | undefined
): ChannelReadiness {
	const primary = accounts?.[0];
	const configured = primary?.configured ?? channel?.configured ?? false;
	const running = primary?.running ?? channel?.running ?? false;
	const tokenStatus = primary?.tokenStatus ?? null;
	const tokenSource = primary?.tokenSource ?? channel?.tokenSource ?? null;
	const lastError = primary?.lastError ?? channel?.lastError ?? null;
	const connected = primary?.connected ?? running;

	if (!configured) {
		return {
			...fallbackChannel(id, label),
			label,
			detail: `${label} is not configured yet`
		};
	}

	if (tokenStatus === 'missing' || tokenSource === 'none') {
		return {
			id,
			label,
			state: 'needs_input',
			summary: 'Needs input',
			detail: `Add valid ${label} credentials`,
			href: CHANNEL_HREFS[id],
			ctaLabel: 'Add credentials',
			configured,
			running,
			error: lastError ?? undefined
		};
	}

	if (lastError) {
		return {
			id,
			label,
			state: 'misconfigured',
			summary: 'Repair needed',
			detail: lastError,
			href: CHANNEL_HREFS[id],
			ctaLabel: 'Repair',
			configured,
			running,
			error: lastError
		};
	}

	if (id === 'discord' && !connected) {
		return {
			id,
			label,
			state: 'degraded',
			summary: 'Disconnected',
			detail: 'Bot configured but not connected',
			href: CHANNEL_HREFS[id],
			ctaLabel: 'Reconnect',
			configured,
			running,
			error: lastError ?? undefined
		};
	}

	if (id === 'telegram' && !running) {
		return {
			id,
			label,
			state: 'degraded',
			summary: 'Stopped',
			detail: primary?.mode ? `Bot is not running in ${primary.mode} mode` : 'Bot is not running',
			href: CHANNEL_HREFS[id],
			ctaLabel: 'Repair',
			configured,
			running,
			error: lastError ?? undefined
		};
	}

	return {
		id,
		label,
		state: 'ready',
		summary: 'Ready',
		detail:
			id === 'discord'
				? primary?.bot?.username
					? `Connected as ${primary.bot.username}`
					: 'Bot connected'
				: primary?.mode
					? `Running in ${primary.mode} mode`
					: 'Bot running',
		href: CHANNEL_HREFS[id],
		ctaLabel: 'Open wizard',
		configured,
		running,
		error: lastError ?? undefined
	};
}
