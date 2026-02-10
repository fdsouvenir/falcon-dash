import { writable, readonly, derived, type Readable } from 'svelte/store';
import { snapshot, eventBus } from '$lib/stores/gateway.js';

export interface DiscordStatus {
	connected: boolean;
	guildId?: string;
	guildName?: string;
}

const _discordStatus = writable<DiscordStatus>({ connected: false });

export const discordStatus: Readable<DiscordStatus> = readonly(_discordStatus);

export const isDiscordConnected: Readable<boolean> = derived(
	_discordStatus,
	($status) => $status.connected
);

const _cleanupFns: Array<() => void> = [];

/** Initialize Discord status from snapshot health data */
export function initDiscordStatus(): void {
	const unsub = snapshot.health.subscribe((health) => {
		const discord = health.discord as Record<string, unknown> | undefined;
		if (discord) {
			_discordStatus.set({
				connected: (discord.connected as boolean) ?? false,
				guildId: discord.guildId as string | undefined,
				guildName: discord.guildName as string | undefined
			});
		}
	});
	// Store unsub for cleanup if needed
	_cleanupFns.push(unsub);
}

/** Subscribe to Discord-related events */
export function subscribeToDiscordEvents(): void {
	_cleanupFns.push(
		eventBus.on('discord', (payload) => {
			const action = payload.action as string;
			if (action === 'connected') {
				_discordStatus.update((s) => ({
					...s,
					connected: true,
					guildId: (payload.guildId as string) ?? s.guildId,
					guildName: (payload.guildName as string) ?? s.guildName
				}));
			} else if (action === 'disconnected') {
				_discordStatus.update((s) => ({ ...s, connected: false }));
			}
		})
	);
}

/** Clean up subscriptions */
export function cleanupDiscord(): void {
	for (const fn of _cleanupFns) fn();
	_cleanupFns.length = 0;
}
