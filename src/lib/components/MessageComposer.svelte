<script lang="ts">
	import SlashCommandMenu from './SlashCommandMenu.svelte';
	import EffectPicker from './EffectPicker.svelte';
	import {
		filterCommands,
		parseCommand,
		type SlashCommand,
		type CommandContext
	} from '$lib/chat/commands.js';
	import { activeSessionKey } from '$lib/stores/sessions.js';
	import { addToast } from '$lib/stores/toast.js';
	import { get } from 'svelte/store';
	import type { SendEffect } from '$lib/stores/chat.js';

	let {
		onSend,
		onAbort,
		onPoll,
		onSendWithEffect,
		disabled = false,
		isStreaming = false
	}: {
		onSend: (message: string, attachments?: File[]) => void;
		onAbort: () => void;
		onPoll?: () => void;
		onSendWithEffect?: (message: string, effect: SendEffect, attachments?: File[]) => void;
		disabled: boolean;
		isStreaming: boolean;
	} = $props();

	let text = $state('');
	let attachments = $state<File[]>([]);
	let textarea: HTMLTextAreaElement;
	let fileInput: HTMLInputElement;
	let isDragging = $state(false);
	let selectedEffect = $state<SendEffect | null>(null);
	let showEffectPicker = $state(false);

	// Slash command state
	let showCommandMenu = $state(false);
	let commandQuery = $state('');
	let commandSelectedIndex = $state(0);

	function updateCommandMenu() {
		if (text.startsWith('/') && !text.includes('\n')) {
			const afterSlash = text.slice(1);
			const hasSpace = afterSlash.includes(' ');
			if (hasSpace) {
				showCommandMenu = false;
				return;
			}
			const query = afterSlash;
			commandQuery = query;
			const matches = filterCommands(query);
			showCommandMenu = matches.length > 0;
			if (commandSelectedIndex >= matches.length) {
				commandSelectedIndex = 0;
			}
		} else {
			showCommandMenu = false;
		}
	}

	function handleCommandSelect(cmd: SlashCommand) {
		showCommandMenu = false;
		if (cmd.args) {
			text = `/${cmd.name} `;
			textarea?.focus();
		} else {
			text = `/${cmd.name}`;
			executeSlashCommand();
		}
	}

	async function executeSlashCommand(): Promise<boolean> {
		const parsed = parseCommand(text.trim());
		if (!parsed) return false;
		const sessionKey = get(activeSessionKey);
		if (!sessionKey) return false;
		const ctx: CommandContext = {
			sessionKey,
			abort: async () => {
				onAbort();
			}
		};
		try {
			await parsed.command.handler(parsed.args, ctx);
			addToast(`/${parsed.command.name}${parsed.args ? ' ' + parsed.args : ''}`, 'success');
		} catch (err) {
			console.error(`[SlashCommand] /${parsed.command.name} failed:`, err);
			addToast(
				`/${parsed.command.name} failed: ${err instanceof Error ? err.message : String(err)}`,
				'error'
			);
		}
		text = '';
		resize();
		return true;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (showCommandMenu) {
			const matches = filterCommands(commandQuery);
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				commandSelectedIndex = (commandSelectedIndex + 1) % matches.length;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				commandSelectedIndex = (commandSelectedIndex - 1 + matches.length) % matches.length;
				return;
			}
			if (e.key === 'Enter' && matches.length > 0) {
				e.preventDefault();
				handleCommandSelect(matches[commandSelectedIndex]);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				showCommandMenu = false;
				return;
			}
			if (e.key === 'Tab' && matches.length > 0) {
				e.preventDefault();
				handleCommandSelect(matches[commandSelectedIndex]);
				return;
			}
		}
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	async function send() {
		const trimmed = text.trim();
		if (!trimmed && attachments.length === 0) return;
		if (disabled) return;
		// Try slash command first
		if (trimmed.startsWith('/')) {
			const handled = await executeSlashCommand();
			if (handled) return;
		}
		// Send with effect if one is selected
		if (selectedEffect && onSendWithEffect) {
			onSendWithEffect(trimmed, selectedEffect, attachments.length > 0 ? attachments : undefined);
			selectedEffect = null;
		} else {
			onSend(trimmed, attachments.length > 0 ? attachments : undefined);
		}
		text = '';
		attachments = [];
		resize();
	}

	let resizeRafId: number | undefined;

	function resize() {
		if (resizeRafId) return;
		resizeRafId = requestAnimationFrame(() => {
			resizeRafId = undefined;
			if (!textarea) return;
			textarea.style.height = 'auto';
			textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
		});
	}

	function handleInput() {
		resize();
		updateCommandMenu();
	}

	// File handling
	function addFiles(files: FileList | File[]) {
		const fileArray = Array.from(files);
		attachments = [...attachments, ...fileArray];
	}

	function removeAttachment(index: number) {
		attachments = attachments.filter((_, i) => i !== index);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files.length) {
			addFiles(e.dataTransfer.files);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		const files: File[] = [];
		for (const item of items) {
			if (item.kind === 'file') {
				const file = item.getAsFile();
				if (file) files.push(file);
			}
		}
		if (files.length > 0) {
			addFiles(files);
		}
	}

	function openFileDialog() {
		fileInput?.click();
	}

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.length) {
			addFiles(input.files);
			input.value = '';
		}
	}

	function handleEffectSelect(effect: SendEffect) {
		// Toggle: if same effect is already selected, deselect it
		if (
			selectedEffect &&
			selectedEffect.type === effect.type &&
			selectedEffect.name === effect.name
		) {
			selectedEffect = null;
		} else {
			selectedEffect = effect;
		}
		showEffectPicker = false;
	}

	const EFFECT_LABELS: Record<string, string> = {
		slam: 'Slam',
		loud: 'Loud',
		gentle: 'Gentle',
		'invisible-ink': 'Invisible Ink',
		confetti: 'Confetti',
		fireworks: 'Fireworks',
		hearts: 'Hearts',
		balloons: 'Balloons',
		celebration: 'Celebration',
		lasers: 'Lasers',
		spotlight: 'Spotlight',
		echo: 'Echo'
	};
</script>

<div
	class="border-t border-gray-800 bg-gray-900 px-3 pb-[calc(0.5rem+var(--safe-bottom,0px))] pt-3 md:p-4"
	ondrop={handleDrop}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	role="form"
>
	<!-- Selected effect badge -->
	{#if selectedEffect}
		<div class="mb-2 flex items-center gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2.5 py-1 text-xs text-purple-300"
			>
				Sending with {EFFECT_LABELS[selectedEffect.name] ?? selectedEffect.name}
				<button
					onclick={() => (selectedEffect = null)}
					class="ml-0.5 text-purple-400 hover:text-purple-200"
					aria-label="Remove effect"
				>
					<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</span>
		</div>
	{/if}

	<!-- Attachments preview -->
	{#if attachments.length > 0}
		<div class="mb-2 flex flex-wrap gap-2">
			{#each attachments as file, i (i)}
				<div
					class="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs text-gray-300"
				>
					<!-- File type icon -->
					<span class="text-gray-500">
						{#if file.type.startsWith('image/')}
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
								/>
							</svg>
						{:else if file.type.startsWith('text/') || file.name.match(/\.(js|ts|py|md|json|csv|xml|yaml|yml|html|css|svelte)$/i)}
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
								/>
							</svg>
						{:else}
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
								/>
							</svg>
						{/if}
					</span>
					<span class="max-w-32 truncate">{file.name}</span>
					<span class="text-gray-600">
						{file.size < 1024
							? `${file.size}B`
							: file.size < 1048576
								? `${Math.round(file.size / 1024)}K`
								: `${(file.size / 1048576).toFixed(1)}M`}
					</span>
					<button
						onclick={() => removeAttachment(i)}
						class="text-gray-500 transition-colors hover:text-red-400"
						aria-label="Remove attachment"
					>
						<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Drag overlay -->
	{#if isDragging}
		<div
			class="mb-2 rounded border-2 border-dashed border-blue-500 bg-blue-950 p-4 text-center text-sm text-blue-300"
		>
			Drop files here
		</div>
	{/if}

	<!-- Slash command menu -->
	<div class="relative">
		<SlashCommandMenu
			query={commandQuery}
			visible={showCommandMenu}
			selectedIndex={commandSelectedIndex}
			onSelect={handleCommandSelect}
		/>
	</div>

	<!-- Input area -->
	<div class="flex items-end gap-2">
		<!-- File upload button -->
		<button
			onclick={openFileDialog}
			class="hidden flex-shrink-0 rounded p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white md:flex"
			aria-label="Attach file"
			{disabled}
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
				/>
			</svg>
		</button>
		<input bind:this={fileInput} type="file" multiple class="hidden" onchange={handleFileChange} />

		<!-- Poll button -->
		{#if onPoll}
			<button
				onclick={onPoll}
				class="hidden flex-shrink-0 rounded p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white md:flex"
				aria-label="Create poll"
				{disabled}
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
					/>
				</svg>
			</button>
		{/if}

		<!-- Effect button -->
		{#if onSendWithEffect}
			<div class="relative hidden md:block">
				<button
					onclick={() => (showEffectPicker = !showEffectPicker)}
					class="flex-shrink-0 rounded p-2 transition-colors {selectedEffect
						? 'text-purple-400 hover:bg-purple-900/30 hover:text-purple-300'
						: 'text-gray-400 hover:bg-gray-800 hover:text-white'}"
					aria-label="Add effect"
					{disabled}
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
						/>
					</svg>
				</button>
				{#if showEffectPicker}
					<EffectPicker onSelect={handleEffectSelect} onClose={() => (showEffectPicker = false)} />
				{/if}
			</div>
		{/if}

		<!-- Textarea -->
		<textarea
			bind:this={textarea}
			bind:value={text}
			oninput={handleInput}
			onkeydown={handleKeydown}
			onpaste={handlePaste}
			placeholder={disabled ? 'Agent is responding...' : 'Message...'}
			{disabled}
			rows="1"
			aria-label="Type a message"
			class="flex-1 resize-none rounded-2xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none disabled:opacity-50 md:rounded-lg"
		></textarea>

		<!-- Send/Abort button -->
		{#if isStreaming}
			<button
				onclick={onAbort}
				class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-medium text-white transition-colors hover:bg-red-500 md:h-auto md:w-auto md:rounded-lg md:px-4 md:py-2.5"
				aria-label="Stop"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
					/>
				</svg>
			</button>
		{:else}
			<button
				onclick={send}
				disabled={disabled || (!text.trim() && attachments.length === 0)}
				class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 md:h-auto md:w-auto md:rounded-lg md:px-4 md:py-2.5"
				aria-label="Send message"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
					/>
				</svg>
			</button>
		{/if}
	</div>
</div>
