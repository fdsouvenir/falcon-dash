<script lang="ts">
	import {
		notificationSettings,
		updateSettings,
		requestNotificationPermission,
		type NotificationSettings
	} from '$lib/stores/notifications.js';

	let settings = $state<NotificationSettings>({
		soundEnabled: true,
		browserNotificationsEnabled: false,
		soundVolume: 0.5
	});

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
</div>
