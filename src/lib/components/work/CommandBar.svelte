<script lang="ts">
	import BottomSheet from '$lib/components/mobile/BottomSheet.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { isMobile } from '$lib/stores/viewport.js';
	import { commandLabel, fieldHint } from '$lib/work3/labels.js';
	import CommandForm from './CommandForm.svelte';
	import EmptyState from './EmptyState.svelte';

	export interface CommandAvailability {
		command: string;
		enabled?: boolean;
		reason?: string;
	}

	interface ChoiceField {
		label?: string;
		options: Array<{
			value: string;
			label: string;
			description?: string;
			recommended?: boolean;
		}>;
	}

	interface Props {
		commands: Array<string | CommandAvailability>;
		targetId?: string;
		expectedVersion?: number;
		form?: Record<string, unknown> | null;
		action?: string;
		title?: string;
		forceRequiredByCommand?: Record<string, string[]>;
		requireAnyOfByCommand?: Record<string, string[]>;
		requireExactlyOneOfByCommand?: Record<string, string[]>;
		presetValuesByCommand?: Record<string, Record<string, string>>;
		choiceFieldsByCommand?: Record<string, Record<string, ChoiceField>>;
		confirmationSubjectByCommand?: Record<string, string>;
		submitLabelByCommand?: Record<string, string>;
	}

	let {
		commands,
		targetId,
		expectedVersion,
		form = null,
		action = '?/command',
		title = 'Available actions',
		forceRequiredByCommand = {},
		requireAnyOfByCommand = {},
		requireExactlyOneOfByCommand = {},
		presetValuesByCommand = {},
		choiceFieldsByCommand = {},
		confirmationSubjectByCommand = {},
		submitLabelByCommand = {}
	}: Props = $props();
	const commandBarId = $props.id();
	const commandBarTitleId = `${commandBarId}-title`;
	let mobile = $state(false);
	let sheetOpen = $state(false);
	let selectedCommand = $state<string | null>(null);

	function availability(entry: string | CommandAvailability): CommandAvailability {
		return typeof entry === 'string' ? { command: entry, enabled: true } : entry;
	}

	const availableCommands = $derived(commands.map(availability));
	const formCommand = $derived(
		availableCommands.find((item) => formMatchesItem(item))?.command ?? null
	);
	const selectedItem = $derived(
		availableCommands.find((item) => item.command === selectedCommand) ?? availableCommands[0]
	);

	function formMatchesItem(item: CommandAvailability): boolean {
		if (form?.command !== item.command) return false;
		const values =
			form.values && typeof form.values === 'object'
				? (form.values as Record<string, unknown>)
				: undefined;
		if (targetId !== undefined && values?.target_id !== targetId) return false;
		return Object.entries(presetValuesByCommand[item.command] ?? {}).every(([field, value]) => {
			const hint = fieldHint(field);
			const key = `${hint.kind === 'json' ? 'payload_json_' : 'payload_'}${field}`;
			return values?.[key] === value;
		});
	}

	$effect(() => isMobile.subscribe((value) => (mobile = value)));

	$effect(() => {
		if (
			!mobile ||
			!formCommand ||
			!availableCommands.some((item) => item.command === formCommand)
		) {
			return;
		}
		selectedCommand = formCommand;
		sheetOpen = true;
	});

	function openSheet() {
		selectedCommand =
			formCommand ??
			availableCommands.find((item) => item.enabled !== false)?.command ??
			availableCommands[0]?.command ??
			null;
		sheetOpen = selectedCommand !== null;
	}

	function closeSheet() {
		sheetOpen = false;
	}
</script>

{#snippet commandForm(item: CommandAvailability)}
	<CommandForm
		command={item.command}
		{targetId}
		{expectedVersion}
		form={form as never}
		{action}
		disabled={item.enabled === false}
		disabledReason={item.reason}
		forceRequired={forceRequiredByCommand[item.command] ?? []}
		requireAnyOf={requireAnyOfByCommand[item.command] ?? []}
		requireExactlyOneOf={requireExactlyOneOfByCommand[item.command] ?? []}
		presetValues={presetValuesByCommand[item.command] ?? {}}
		choiceFields={choiceFieldsByCommand[item.command] ?? {}}
		confirmationSubject={confirmationSubjectByCommand[item.command]}
		submitLabel={submitLabelByCommand[item.command]}
	/>
{/snippet}

{#if mobile}
	<section aria-labelledby={commandBarTitleId}>
		{#if availableCommands.length}
			<div
				class="sticky bottom-[calc(4.25rem+var(--safe-bottom))] z-30 -mx-3 border-y border-outline-variant bg-surface-container/95 px-3 py-3 shadow-none backdrop-blur"
				data-command-bar-mobile
			>
				<div class="flex items-center justify-between gap-3">
					<div class="min-w-0">
						<h2 id={commandBarTitleId} class="truncate font-semibold text-on-surface">{title}</h2>
						<p class="text-[length:var(--text-label)] text-on-surface-variant">
							{availableCommands.length} semantic
							{availableCommands.length === 1 ? 'action' : 'actions'}
						</p>
					</div>
					<Button class="touch-target shrink-0" onclick={openSheet}>
						{availableCommands.length === 1
							? commandLabel(availableCommands[0].command)
							: 'Choose action'}
					</Button>
				</div>
			</div>

			<BottomSheet
				open={sheetOpen}
				onclose={closeSheet}
				maxHeight="88dvh"
				label={`${title} command form`}
			>
				<div class="space-y-4 pb-2" data-command-sheet>
					<div>
						<h2 class="text-lg font-semibold text-on-surface">{title}</h2>
						<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
							Choose and complete one semantic Work action.
						</p>
					</div>

					{#if availableCommands.length > 1}
						<div
							class="flex gap-2 overflow-x-auto pb-1"
							role="toolbar"
							aria-label="Available commands"
						>
							{#each availableCommands as item (item.command)}
								<button
									type="button"
									class="falcon-focus touch-target shrink-0 rounded-full border px-3 py-2 text-[length:var(--text-label)] font-semibold {selectedItem?.command ===
									item.command
										? 'border-primary bg-primary-container text-on-primary-container'
										: 'border-outline-variant bg-surface-container-high text-on-surface'}"
									aria-pressed={selectedItem?.command === item.command}
									onclick={() => (selectedCommand = item.command)}
								>
									{commandLabel(item.command)}
								</button>
							{/each}
						</div>
					{/if}

					{#if selectedItem}
						<div
							class="rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant/70 bg-surface-container-high p-4"
						>
							{@render commandForm(selectedItem)}
						</div>
					{/if}
				</div>
			</BottomSheet>
		{:else}
			<div id={commandBarTitleId}>
				<EmptyState
					title="No actions available"
					description="This item has no legal next command."
				/>
			</div>
		{/if}
	</section>
{:else}
	<section
		class="space-y-4 rounded-[var(--md-sys-shape-corner-large)] border border-outline-variant/70 bg-surface-container p-4 shadow-none sm:p-5"
		aria-labelledby={commandBarTitleId}
	>
		<div>
			<h2 id={commandBarTitleId} class="font-semibold text-on-surface">{title}</h2>
			<p class="mt-1 text-[length:var(--text-label)] text-on-surface-variant">
				Only semantic Work commands are shown here.
			</p>
		</div>
		{#if availableCommands.length}
			<div class="grid gap-4 lg:grid-cols-2">
				{#each availableCommands as item (item.command)}
					<div
						class="rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant/70 bg-surface-container-high p-4"
					>
						{@render commandForm(item)}
					</div>
				{/each}
			</div>
		{:else}
			<EmptyState title="No actions available" description="This item has no legal next command." />
		{/if}
	</section>
{/if}
