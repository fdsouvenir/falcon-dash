<script lang="ts">
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

	function availability(entry: string | CommandAvailability): CommandAvailability {
		return typeof entry === 'string' ? { command: entry, enabled: true } : entry;
	}
</script>

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
	{#if commands.length}
		<div class="grid gap-4 lg:grid-cols-2">
			{#each commands as entry (availability(entry).command)}
				{@const item = availability(entry)}
				<div
					class="rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant/70 bg-surface-container-high p-4"
				>
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
				</div>
			{/each}
		</div>
	{:else}
		<EmptyState title="No actions available" description="This item has no legal next command." />
	{/if}
</section>
