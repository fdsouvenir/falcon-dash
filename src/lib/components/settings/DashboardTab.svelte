<script lang="ts">
	import {
		requestNotificationPermission,
		getNotificationPermission
	} from '$lib/services/notifications';
	import { theme as themeStore, setTheme as setThemeStore } from '$lib/stores/theme';
	import type { Theme } from '$lib/stores/theme';

	let notificationsEnabled = true;
	let notificationSound = true;
	let compactMode = false;
	let pushPermission: 'default' | 'denied' | 'granted' = 'default';

	$: currentTheme = $themeStore;

	function loadPreferences(): void {
		try {
			const stored = localStorage.getItem('falcon-dash:preferences');
			if (stored) {
				const prefs = JSON.parse(stored);
				if (typeof prefs.notificationsEnabled === 'boolean')
					notificationsEnabled = prefs.notificationsEnabled;
				if (typeof prefs.notificationSound === 'boolean')
					notificationSound = prefs.notificationSound;
				if (typeof prefs.compactMode === 'boolean') compactMode = prefs.compactMode;
			}
		} catch {
			// Invalid stored prefs — keep defaults
		}
		pushPermission = getNotificationPermission();
	}

	function savePreferences(): void {
		localStorage.setItem(
			'falcon-dash:preferences',
			JSON.stringify({
				theme: $themeStore,
				notificationsEnabled,
				notificationSound,
				compactMode
			})
		);
	}

	function handleSetTheme(value: Theme): void {
		setThemeStore(value);
	}

	function toggleNotifications(): void {
		notificationsEnabled = !notificationsEnabled;
		savePreferences();
	}

	function toggleNotificationSound(): void {
		notificationSound = !notificationSound;
		savePreferences();
	}

	function toggleCompactMode(): void {
		compactMode = !compactMode;
		savePreferences();
	}

	async function handleEnablePush(): Promise<void> {
		pushPermission = await requestNotificationPermission();
	}

	loadPreferences();
</script>

<div class="space-y-6 overflow-y-auto p-6">
	<!-- Theme -->
	<section class="rounded-lg border border-slate-700 bg-slate-800/50">
		<div class="border-b border-slate-700 px-5 py-3">
			<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">Theme</h2>
		</div>
		<div class="p-5">
			<p class="mb-4 text-sm text-slate-400">
				Choose the appearance of the dashboard. System follows your OS preference.
			</p>
			<div class="flex gap-3">
				<button
					on:click={() => handleSetTheme('dark')}
					class="flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors {currentTheme ===
					'dark'
						? 'border-blue-500 bg-blue-500/10 text-blue-400'
						: 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}"
				>
					<div class="mb-1 text-lg">&#9790;</div>
					Dark
				</button>
				<button
					on:click={() => handleSetTheme('light')}
					class="flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors {currentTheme ===
					'light'
						? 'border-blue-500 bg-blue-500/10 text-blue-400'
						: 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}"
				>
					<div class="mb-1 text-lg">&#9728;</div>
					Light
				</button>
				<button
					on:click={() => handleSetTheme('system')}
					class="flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors {currentTheme ===
					'system'
						? 'border-blue-500 bg-blue-500/10 text-blue-400'
						: 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'}"
				>
					<div class="mb-1 text-lg">&#9881;</div>
					System
				</button>
			</div>
		</div>
	</section>

	<!-- Notifications -->
	<section class="rounded-lg border border-slate-700 bg-slate-800/50">
		<div class="border-b border-slate-700 px-5 py-3">
			<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">Notifications</h2>
		</div>
		<div class="space-y-4 p-5">
			<!-- Enable notifications toggle -->
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-slate-200">Enable Notifications</p>
					<p class="mt-0.5 text-xs text-slate-400">
						Show browser notifications for agent responses, mentions, and alerts.
					</p>
				</div>
				<button
					role="switch"
					aria-checked={notificationsEnabled}
					on:click={toggleNotifications}
					class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {notificationsEnabled
						? 'bg-blue-600'
						: 'bg-slate-600'}"
				>
					<span
						class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {notificationsEnabled
							? 'translate-x-6'
							: 'translate-x-1'}"
					/>
				</button>
			</div>

			<!-- Notification sound toggle -->
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-slate-200">Notification Sound</p>
					<p class="mt-0.5 text-xs text-slate-400">Play a sound when notifications arrive.</p>
				</div>
				<button
					role="switch"
					aria-checked={notificationSound}
					on:click={toggleNotificationSound}
					class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {notificationSound
						? 'bg-blue-600'
						: 'bg-slate-600'}"
				>
					<span
						class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {notificationSound
							? 'translate-x-6'
							: 'translate-x-1'}"
					/>
				</button>
			</div>

			<!-- Push notification permission -->
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-slate-200">Push Notifications</p>
					<p class="mt-0.5 text-xs text-slate-400">
						{#if pushPermission === 'granted'}
							Push notifications are enabled.
						{:else if pushPermission === 'denied'}
							Push notifications are blocked. Update in browser settings.
						{:else}
							Allow push notifications for background alerts.
						{/if}
					</p>
				</div>
				{#if pushPermission === 'granted'}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400"
					>
						<span class="inline-block h-1.5 w-1.5 rounded-full bg-green-400"></span>
						Enabled
					</span>
				{:else if pushPermission === 'denied'}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400"
					>
						Blocked
					</span>
				{:else}
					<button
						on:click={handleEnablePush}
						class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
					>
						Enable
					</button>
				{/if}
			</div>
		</div>
	</section>

	<!-- Display -->
	<section class="rounded-lg border border-slate-700 bg-slate-800/50">
		<div class="border-b border-slate-700 px-5 py-3">
			<h2 class="text-sm font-semibold uppercase tracking-wider text-slate-300">Display</h2>
		</div>
		<div class="p-5">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-slate-200">Compact Mode</p>
					<p class="mt-0.5 text-xs text-slate-400">
						Reduce spacing and padding for a denser layout.
					</p>
				</div>
				<button
					role="switch"
					aria-checked={compactMode}
					on:click={toggleCompactMode}
					class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {compactMode
						? 'bg-blue-600'
						: 'bg-slate-600'}"
				>
					<span
						class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {compactMode
							? 'translate-x-6'
							: 'translate-x-1'}"
					/>
				</button>
			</div>
		</div>
	</section>
</div>
