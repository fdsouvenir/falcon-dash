<script lang="ts">
	import { snapshot, call } from '$lib/stores/gateway.js';
	import { activeSessionKey } from '$lib/stores/sessions.js';
	import ChatSettingsForm from '$lib/components/ChatSettingsForm.svelte';

	let {
		open = false
	}: {
		open?: boolean;
	} = $props();

	let model = $state('');
	let thinkingLevel = $state('off');
	let verbose = $state(false);
	let currentSessionKey = $state<string | null>(null);

	$effect(() => {
		const unsub = snapshot.sessionDefaults.subscribe((defaults) => {
			model = defaults.model ?? '';
			thinkingLevel = defaults.thinkingLevel ?? 'off';
		});
		return unsub;
	});

	$effect(() => {
		const unsub = activeSessionKey.subscribe((v) => {
			currentSessionKey = v;
		});
		return unsub;
	});

	async function updateSetting(field: string, value: unknown) {
		if (!currentSessionKey) return;
		await call('sessions.patch', { key: currentSessionKey, [field]: value });
	}

	async function handleModelChange(e: Event) {
		const input = e.target as HTMLInputElement;
		model = input.value;
		await updateSetting('model', model);
	}

	async function handleThinkingChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		thinkingLevel = select.value;
		await updateSetting('thinkingLevel', thinkingLevel);
	}

	async function toggleVerbose() {
		verbose = !verbose;
		await updateSetting('verbose', verbose);
	}

	async function resetSession() {
		if (!currentSessionKey) return;
		await call('sessions.reset', { sessionKey: currentSessionKey });
	}

	async function compactTranscript() {
		if (!currentSessionKey) return;
		await call('sessions.compact', { sessionKey: currentSessionKey });
	}
</script>

<div
	class="overflow-hidden border-b border-gray-800 bg-gray-900 transition-[max-height] duration-300 ease-in-out"
	style="max-height: {open ? '300px' : '0px'}"
>
	<div class="px-4 py-3">
		<ChatSettingsForm
			{model}
			{thinkingLevel}
			{verbose}
			onModelChange={handleModelChange}
			onThinkingChange={handleThinkingChange}
			onToggleVerbose={toggleVerbose}
			onReset={resetSession}
			onCompact={compactTranscript}
		/>
	</div>
</div>
