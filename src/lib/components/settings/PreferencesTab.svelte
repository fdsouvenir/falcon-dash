<script lang="ts">
	interface Preferences {
		theme: 'dark' | 'light' | 'system';
		notificationsEnabled: boolean;
		soundEnabled: boolean;
		compactMode: boolean;
		defaultPmView: 'dashboard' | 'kanban' | 'list' | 'tree';
	}

	const defaultPreferences: Preferences = {
		theme: 'system',
		notificationsEnabled: true,
		soundEnabled: true,
		compactMode: false,
		defaultPmView: 'dashboard'
	};

	let preferences = $state<Preferences>(loadPreferences());

	function loadPreferences(): Preferences {
		if (typeof localStorage === 'undefined') return defaultPreferences;
		const stored = localStorage.getItem('falcon-dash-preferences');
		if (!stored) return defaultPreferences;
		try {
			return { ...defaultPreferences, ...JSON.parse(stored) };
		} catch {
			return defaultPreferences;
		}
	}

	function savePreferences() {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem('falcon-dash-preferences', JSON.stringify(preferences));
	}

	function applyTheme(theme: 'dark' | 'light' | 'system') {
		const html = document.documentElement;
		if (theme === 'system') {
			const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			html.classList.toggle('dark', isDark);
		} else {
			html.classList.toggle('dark', theme === 'dark');
		}
	}

	function applyCompactMode(compact: boolean) {
		document.documentElement.classList.toggle('compact', compact);
	}

	// Apply preferences on mount
	$effect(() => {
		applyTheme(preferences.theme);
		applyCompactMode(preferences.compactMode);
	});

	// Listen for system theme changes when theme is 'system'
	$effect(() => {
		if (preferences.theme !== 'system') return;
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handler = () => applyTheme('system');
		mediaQuery.addEventListener('change', handler);
		return () => mediaQuery.removeEventListener('change', handler);
	});

	function updateTheme(theme: 'dark' | 'light' | 'system') {
		preferences.theme = theme;
		applyTheme(theme);
		savePreferences();
	}

	function toggleNotifications() {
		preferences.notificationsEnabled = !preferences.notificationsEnabled;
		savePreferences();
	}

	function toggleSound() {
		preferences.soundEnabled = !preferences.soundEnabled;
		savePreferences();
	}

	function toggleCompactMode() {
		preferences.compactMode = !preferences.compactMode;
		applyCompactMode(preferences.compactMode);
		savePreferences();
	}

	function updateDefaultPmView(view: 'dashboard' | 'kanban' | 'list' | 'tree') {
		preferences.defaultPmView = view;
		savePreferences();
	}
</script>

<div class="flex flex-col gap-6 p-6">
	<!-- Appearance Card -->
	<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">Appearance</h3>
		<div class="space-y-4">
			<!-- Theme -->
			<div>
				<label class="mb-2 block text-sm font-medium text-gray-300">Theme</label>
				<div class="flex gap-2">
					<button
						onclick={() => updateTheme('dark')}
						class="flex-1 rounded px-4 py-2 text-sm {preferences.theme === 'dark'
							? 'bg-blue-600 text-white'
							: 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
					>
						Dark
					</button>
					<button
						onclick={() => updateTheme('light')}
						class="flex-1 rounded px-4 py-2 text-sm {preferences.theme === 'light'
							? 'bg-blue-600 text-white'
							: 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
					>
						Light
					</button>
					<button
						onclick={() => updateTheme('system')}
						class="flex-1 rounded px-4 py-2 text-sm {preferences.theme === 'system'
							? 'bg-blue-600 text-white'
							: 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
					>
						System
					</button>
				</div>
			</div>

			<!-- Compact Mode -->
			<div class="flex items-center justify-between">
				<div>
					<div class="text-sm font-medium text-gray-300">Compact Mode</div>
					<div class="text-xs text-gray-400">Use denser spacing for UI elements</div>
				</div>
				<button
					onclick={toggleCompactMode}
					class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {preferences.compactMode
						? 'bg-blue-600'
						: 'bg-gray-600'}"
					role="switch"
					aria-checked={preferences.compactMode}
				>
					<span
						class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {preferences.compactMode
							? 'translate-x-6'
							: 'translate-x-1'}"
					></span>
				</button>
			</div>
		</div>
	</div>

	<!-- Notifications Card -->
	<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">Notifications</h3>
		<div class="space-y-4">
			<!-- Enable Notifications -->
			<div class="flex items-center justify-between">
				<div>
					<div class="text-sm font-medium text-gray-300">Browser Notifications</div>
					<div class="text-xs text-gray-400">Show desktop notifications for important events</div>
				</div>
				<button
					onclick={toggleNotifications}
					class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {preferences.notificationsEnabled
						? 'bg-blue-600'
						: 'bg-gray-600'}"
					role="switch"
					aria-checked={preferences.notificationsEnabled}
				>
					<span
						class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {preferences.notificationsEnabled
							? 'translate-x-6'
							: 'translate-x-1'}"
					></span>
				</button>
			</div>

			<!-- Sound -->
			<div class="flex items-center justify-between">
				<div>
					<div class="text-sm font-medium text-gray-300">Notification Sound</div>
					<div class="text-xs text-gray-400">Play sound when notifications appear</div>
				</div>
				<button
					onclick={toggleSound}
					class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {preferences.soundEnabled
						? 'bg-blue-600'
						: 'bg-gray-600'}"
					role="switch"
					aria-checked={preferences.soundEnabled}
					disabled={!preferences.notificationsEnabled}
				>
					<span
						class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {preferences.soundEnabled
							? 'translate-x-6'
							: 'translate-x-1'}"
					></span>
				</button>
			</div>
		</div>
	</div>

	<!-- Project Management Card -->
	<div class="rounded-lg border border-gray-700 bg-gray-800 p-4">
		<h3 class="mb-4 text-lg font-semibold text-white">Project Management</h3>
		<div>
			<label class="mb-2 block text-sm font-medium text-gray-300">Default View</label>
			<select
				value={preferences.defaultPmView}
				onchange={(e) =>
					updateDefaultPmView(e.currentTarget.value as 'dashboard' | 'kanban' | 'list' | 'tree')}
				class="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			>
				<option value="dashboard">Dashboard</option>
				<option value="kanban">Kanban Board</option>
				<option value="list">List View</option>
				<option value="tree">Tree View</option>
			</select>
			<div class="mt-1 text-xs text-gray-400">
				Choose which view to show by default when opening Project Management
			</div>
		</div>
	</div>
</div>
