<script lang="ts">
	import {
		notificationSettings,
		updateSettings,
		requestNotificationPermission,
		type NotificationSettings,
		type NotificationCategory
	} from '$lib/stores/notifications.js';

	let settings = $state<NotificationSettings>({
		soundEnabled: true,
		browserNotificationsEnabled: false,
		soundVolume: 0.5,
		mutedCategories: { chat: false, system: false, cron: false, approval: false }
	});

	const categoryLabels: Record<NotificationCategory, string> = {
		chat: 'Chat messages',
		system: 'System events',
		cron: 'Cron jobs',
		approval: 'Exec approvals'
	};

	const categories: NotificationCategory[] = ['chat', 'cron', 'approval', 'system'];

	$effect(() => {
		const unsub = notificationSettings.subscribe((v) => {
			settings = v;
		});
		return unsub;
	});

	function toggleSound() {
		updateSettings({ soundEnabled: !settings.soundEnabled });
	}

	async function toggleBrowserNotifications() {
		if (!settings.browserNotificationsEnabled) {
			const granted = await requestNotificationPermission();
			if (granted) {
				updateSettings({ browserNotificationsEnabled: true });
			}
		} else {
			updateSettings({ browserNotificationsEnabled: false });
		}
	}

	function handleVolumeChange(e: Event) {
		const input = e.target as HTMLInputElement;
		updateSettings({ soundVolume: parseFloat(input.value) });
	}

	function toggleCategory(cat: NotificationCategory) {
		const muted = { ...settings.mutedCategories };
		muted[cat] = !muted[cat];
		updateSettings({ mutedCategories: muted });
	}
</script>

<div class="flex flex-col gap-3">
	<div class="text-xs font-medium text-gray-400">Notifications</div>

	<label class="flex items-center justify-between">
		<span class="text-xs text-gray-300">Sound notifications</span>
		<input type="checkbox" checked={settings.soundEnabled} onchange={toggleSound} class="rounded" />
	</label>

	{#if settings.soundEnabled}
		<label class="flex items-center gap-2">
			<span class="text-xs text-gray-400">Volume</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.1"
				value={settings.soundVolume}
				oninput={handleVolumeChange}
				class="flex-1"
			/>
		</label>
	{/if}

	<label class="flex items-center justify-between">
		<span class="text-xs text-gray-300">Browser notifications</span>
		<input
			type="checkbox"
			checked={settings.browserNotificationsEnabled}
			onchange={toggleBrowserNotifications}
			class="rounded"
		/>
	</label>

	<div class="mt-2 border-t border-gray-700 pt-3">
		<div class="mb-2 text-xs font-medium text-gray-400">Categories</div>
		{#each categories as cat (cat)}
			<label class="flex items-center justify-between py-0.5">
				<span class="text-xs text-gray-300">{categoryLabels[cat]}</span>
				<input
					type="checkbox"
					checked={!settings.mutedCategories[cat]}
					onchange={() => toggleCategory(cat)}
					class="rounded"
				/>
			</label>
		{/each}
	</div>
</div>
