<script lang="ts">
	import {
		preferences,
		setCompactModePreference,
		setNotificationsPreference,
		setSoundPreference,
		setTextSizePreference,
		setThemePreference,
		type FalconPreferences,
		type TextSize
	} from '$lib/stores/preferences.js';
	import type { ThemeMode } from '$lib/theme/theme-manager.js';

	let current = $state<FalconPreferences>({
		theme: 'system',
		notificationsEnabled: true,
		soundEnabled: true,
		compactMode: false,
		textSize: 'comfortable'
	});
	let hydrated = $state(false);

	const textSizeOptions: { value: TextSize; label: string; detail: string }[] = [
		{ value: 'comfortable', label: 'Comfortable', detail: 'Readable default' },
		{ value: 'large', label: 'Large', detail: 'Bigger interface text' },
		{ value: 'extra-large', label: 'Extra large', detail: 'Maximum app text' }
	];

	$effect(() => {
		const unsubscribe = preferences.subscribe((value) => {
			current = value;
		});
		hydrated = true;
		return unsubscribe;
	});

	function updateTheme(theme: ThemeMode) {
		setThemePreference(theme);
	}

	function updateTextSize(textSize: TextSize) {
		setTextSizePreference(textSize);
	}

	function toggleNotifications() {
		setNotificationsPreference(!current.notificationsEnabled);
	}

	function toggleSound() {
		setSoundPreference(!current.soundEnabled);
	}

	function toggleCompactMode() {
		setCompactModePreference(!current.compactMode);
	}
</script>

<div
	class="flex flex-col gap-6 p-6"
	data-testid="settings-preferences-panel"
	data-hydrated={hydrated}
>
	<!-- Appearance Card -->
	<div class="rounded-lg border border-surface-border bg-surface-2 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">Appearance</h3>
		<div class="space-y-4">
			<!-- Theme -->
			<div>
				<p id="theme-preference-label" class="mb-2 text-sm font-medium text-white/70">Theme</p>
				<div class="flex gap-2" role="group" aria-labelledby="theme-preference-label">
					<button
						onclick={() => updateTheme('dark')}
						class="flex-1 rounded px-4 py-2 text-sm {current.theme === 'dark'
							? 'bg-blue-600 text-white'
							: 'bg-surface-3 text-white/70 hover:bg-surface-3'}"
					>
						Dark
					</button>
					<button
						onclick={() => updateTheme('light')}
						class="flex-1 rounded px-4 py-2 text-sm {current.theme === 'light'
							? 'bg-blue-600 text-white'
							: 'bg-surface-3 text-white/70 hover:bg-surface-3'}"
					>
						Light
					</button>
					<button
						onclick={() => updateTheme('system')}
						class="flex-1 rounded px-4 py-2 text-sm {current.theme === 'system'
							? 'bg-blue-600 text-white'
							: 'bg-surface-3 text-white/70 hover:bg-surface-3'}"
					>
						System
					</button>
				</div>
			</div>

			<!-- Text Size -->
			<div>
				<p id="text-size-preference-label" class="mb-2 text-sm font-medium text-white/70">
					Text size
				</p>
				<div
					class="grid gap-2 sm:grid-cols-3"
					role="group"
					aria-labelledby="text-size-preference-label"
				>
					{#each textSizeOptions as option (option.value)}
						<button
							type="button"
							onclick={() => updateTextSize(option.value)}
							class="rounded border px-4 py-3 text-left transition {current.textSize ===
							option.value
								? 'border-blue-400 bg-blue-600 text-white'
								: 'border-surface-border bg-surface-3 text-white/70 hover:border-blue-400 hover:text-white'}"
							aria-pressed={current.textSize === option.value}
						>
							<span class="block text-sm font-semibold">{option.label}</span>
							<span class="mt-1 block text-xs opacity-80">{option.detail}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Compact Mode -->
			<div class="flex items-center justify-between">
				<div>
					<div class="text-sm font-medium text-white/70">Compact Mode</div>
					<div class="text-xs text-status-muted">Use denser spacing without shrinking text</div>
				</div>
				<button
					onclick={toggleCompactMode}
					class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {current.compactMode
						? 'bg-blue-600'
						: 'bg-surface-3'}"
					role="switch"
					aria-checked={current.compactMode}
					aria-label="Compact mode"
				>
					<span
						class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {current.compactMode
							? 'translate-x-6'
							: 'translate-x-1'}"
					></span>
				</button>
			</div>
		</div>
	</div>

	<!-- Notifications Card -->
	<div class="rounded-lg border border-surface-border bg-surface-2 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">Notifications</h3>
		<div class="space-y-4">
			<!-- Enable Notifications -->
			<div class="flex items-center justify-between">
				<div>
					<div class="text-sm font-medium text-white/70">Browser Notifications</div>
					<div class="text-xs text-status-muted">
						Show desktop notifications for important events
					</div>
				</div>
				<button
					onclick={toggleNotifications}
					class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {current.notificationsEnabled
						? 'bg-blue-600'
						: 'bg-surface-3'}"
					role="switch"
					aria-checked={current.notificationsEnabled}
					aria-label="Browser notifications"
				>
					<span
						class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {current.notificationsEnabled
							? 'translate-x-6'
							: 'translate-x-1'}"
					></span>
				</button>
			</div>

			<!-- Sound -->
			<div class="flex items-center justify-between">
				<div>
					<div class="text-sm font-medium text-white/70">Notification Sound</div>
					<div class="text-xs text-status-muted">Play sound when notifications appear</div>
				</div>
				<button
					onclick={toggleSound}
					class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {current.soundEnabled
						? 'bg-blue-600'
						: 'bg-surface-3'}"
					role="switch"
					aria-checked={current.soundEnabled}
					disabled={!current.notificationsEnabled}
					aria-label="Notification sound"
				>
					<span
						class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {current.soundEnabled
							? 'translate-x-6'
							: 'translate-x-1'}"
					></span>
				</button>
			</div>
		</div>
	</div>

	<!-- eslint-disable svelte/no-navigation-without-resolve -- external Cloudflare path, not a SvelteKit route -->
	<!-- Session Card -->
	<div class="rounded-lg border border-surface-border bg-surface-2 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">Session</h3>
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<div>
					<div class="text-sm font-medium text-white/70">Log Out (Cloudflare)</div>
					<div class="text-xs text-status-muted">
						End your Cloudflare Access session and sign out completely
					</div>
				</div>
				<a
					href="/cdn-cgi/access/logout"
					class="rounded bg-surface-3 px-3 py-1.5 text-sm text-white/70 hover:bg-surface-3 hover:text-white"
				>
					Log out
				</a>
			</div>
		</div>
	</div>
</div>
