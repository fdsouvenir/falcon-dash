<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { tick } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger
	} from '$lib/components/ui/collapsible/index.js';
	import { ConfirmDialog } from '$lib/components/ui/confirm-dialog/index.js';
	import { Field } from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Select } from '$lib/components/ui/select/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { commandMeta } from '$lib/work3-shared/commands.js';
	import {
		commandLabel,
		commandSummary,
		fieldHint,
		fieldLabel,
		isDestructive,
		requiresConfirmation
	} from '$lib/work3/labels.js';

	interface FormShape {
		command?: string;
		values?: Record<string, string>;
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
		command: string;
		targetId?: string;
		expectedVersion?: number;
		form?: FormShape | null;
		action?: string;
		disabled?: boolean;
		disabledReason?: string;
		compact?: boolean;
		presetValues?: Record<string, string>;
		forceRequired?: string[];
		confirmationSubject?: string;
		choiceFields?: Record<string, ChoiceField>;
	}

	let {
		command,
		targetId,
		expectedVersion,
		form = null,
		action = '?/command',
		disabled = false,
		disabledReason,
		compact = false,
		presetValues = {},
		forceRequired = [],
		confirmationSubject,
		choiceFields = {}
	}: Props = $props();

	const formId = $props.id();
	const meta = $derived(commandMeta(command));
	const requiredFields = $derived(
		[...new Set([...(meta?.required ?? []), ...forceRequired])].filter(
			(field) => presetValues[field] === undefined
		)
	);
	const optionalFields = $derived(
		(meta?.optional ?? []).filter(
			(field) => !requiredFields.includes(field) && presetValues[field] === undefined
		)
	);
	const destructive = $derived(isDestructive(command));
	const confirmationRequired = $derived(requiresConfirmation(command));
	let confirmationOpen = $state(false);
	let confirmationDetails = $state<Array<{ label: string; value: string }>>([]);
	let confirmed = $state(false);
	let submitting = $state(false);
	let formElement: HTMLFormElement | undefined = $state();
	let resolveConfirmation: (() => void) | undefined;

	function preserved(field: string): string {
		const values = form?.values;
		if (!values || !formMatchesPreset()) return '';
		const hint = fieldHint(field);
		if (hint.kind === 'datetime-local') {
			const displayValue = values[`display_${field}`];
			if (displayValue) return displayValue;
			const epoch = Number(values[`payload_${field}`]);
			if (Number.isFinite(epoch) && epoch > 0) {
				const date = new Date(epoch);
				return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
					.toISOString()
					.slice(0, 16);
			}
		}
		const prefix = hint.kind === 'json' ? 'payload_json_' : 'payload_';
		return values[`${prefix}${field}`] ?? '';
	}

	function formMatchesPreset(): boolean {
		if (form?.command !== command) return false;
		return Object.entries(presetValues).every(([field, value]) => {
			const hint = fieldHint(field);
			const prefix = hint.kind === 'json' ? 'payload_json_' : 'payload_';
			return form.values?.[`${prefix}${field}`] === value;
		});
	}

	function normalizeDateFields(formData: FormData) {
		for (const field of [...requiredFields, ...optionalFields]) {
			if (fieldHint(field).kind !== 'datetime-local') continue;
			const key = `payload_${field}`;
			const value = formData.get(key);
			if (typeof value !== 'string' || value === '') continue;
			const epoch = new Date(value).getTime();
			if (Number.isFinite(epoch)) {
				formData.set(`display_${field}`, value);
				formData.set(key, String(epoch));
			}
		}
	}

	const enhanceSubmit: SubmitFunction = ({ cancel, formData }) => {
		if (!confirmationRequired || confirmed) {
			normalizeDateFields(formData);
			submitting = true;
			return async ({ update }) => {
				try {
					await update();
				} finally {
					confirmed = false;
					submitting = false;
					resolveConfirmation?.();
					resolveConfirmation = undefined;
				}
			};
		}
		cancel();
		confirmationDetails = confirmationSummary(formData);
		confirmationOpen = true;
	};

	function confirmationSummary(formData: FormData): Array<{ label: string; value: string }> {
		const details = confirmationSubject ? [{ label: 'Selection', value: confirmationSubject }] : [];
		for (const field of requiredFields) {
			const hint = fieldHint(field);
			const prefix = hint.kind === 'json' ? 'payload_json_' : 'payload_';
			const value = formData.get(`${prefix}${field}`);
			if (typeof value === 'string' && value.trim()) {
				const choice = choiceFields[field]?.options.find((option) => option.value === value);
				details.push({
					label: fieldLabel(field),
					value: choice ? `${choice.label} (${choice.value})` : value
				});
			}
		}
		return details;
	}

	async function confirm() {
		confirmed = true;
		await tick();
		await new Promise<void>((resolve) => {
			resolveConfirmation = resolve;
			if (formElement) {
				formElement.requestSubmit();
			} else {
				resolve();
			}
		});
	}

	function canClear(field: string): boolean {
		return new Set([
			'summary',
			'completion_condition',
			'priority',
			'owner',
			'due_at',
			'target_at',
			'project_id',
			'phase_id',
			'item_id',
			'health'
		]).has(field);
	}

	function clearPreserved(field: string): boolean {
		return form?.command === command && form.values?.[`payload_json_${field}`] === 'null';
	}
</script>

{#snippet commandField(field: string, required: boolean)}
	{@const hint = fieldHint(field)}
	{@const name = `${hint.kind === 'json' ? 'payload_json_' : 'payload_'}${field}`}
	{@const choice = choiceFields[field]}
	{#if choice}
		<fieldset class="space-y-2">
			<legend class="text-[length:var(--text-label)] font-semibold text-on-surface">
				{choice.label ?? fieldLabel(field)}{required ? ' *' : ''}
			</legend>
			<div class="grid gap-2">
				{#each choice.options as option, index (option.value)}
					<label
						class="falcon-focus touch-target flex cursor-pointer gap-3 rounded-[var(--md-sys-shape-corner-medium)] border border-outline-variant bg-surface-container-high p-3 has-[input:checked]:border-primary has-[input:checked]:bg-primary-container"
					>
						<input
							id={`${formId}-${field}-${index}`}
							type="radio"
							{name}
							value={option.value}
							checked={preserved(field) === option.value}
							{required}
							class="mt-1 size-4 shrink-0 accent-primary"
						/>
						<span class="min-w-0">
							<span class="flex flex-wrap items-center gap-2 font-medium text-on-surface">
								{option.label}
								{#if option.recommended}
									<span
										class="rounded-full bg-status-purple-bg px-2 py-0.5 text-[length:var(--text-badge)] font-semibold text-status-purple"
									>
										Recommended
									</span>
								{/if}
							</span>
							{#if option.description}
								<span
									class="mt-1 block text-[length:var(--text-label)] leading-relaxed text-on-surface-variant"
								>
									{option.description}
								</span>
							{/if}
						</span>
					</label>
				{/each}
			</div>
		</fieldset>
	{:else}
		<Field
			label={fieldLabel(field)}
			{required}
			hint={hint.kind === 'json' ? 'Enter valid JSON.' : undefined}
		>
			{#snippet children(context)}
				{#if hint.kind === 'textarea' || hint.kind === 'json'}
					<Textarea
						id={context.id}
						{name}
						value={preserved(field)}
						required={context.required}
						aria-describedby={context.describedBy}
						aria-invalid={context.invalid}
						class={hint.monospace ? 'font-mono text-[length:var(--text-mono)]' : undefined}
						placeholder={hint.placeholder}
						rows={hint.kind === 'json' ? 4 : 3}
					/>
				{:else if hint.kind === 'select'}
					<Select
						id={context.id}
						{name}
						value={preserved(field)}
						required={context.required}
						aria-describedby={context.describedBy}
						aria-invalid={context.invalid}
					>
						<option value="">Select {fieldLabel(field).toLowerCase()}…</option>
						{#each hint.options ?? [] as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</Select>
				{:else}
					<Input
						id={context.id}
						{name}
						type={hint.kind === 'datetime-local' ? 'datetime-local' : 'text'}
						value={preserved(field)}
						required={context.required}
						aria-describedby={context.describedBy}
						aria-invalid={context.invalid}
					/>
				{/if}
			{/snippet}
		</Field>
	{/if}
	{#if !required && canClear(field)}
		<label
			class="falcon-focus touch-target inline-flex cursor-pointer items-center gap-2 rounded text-[length:var(--text-label)] text-on-surface-variant"
		>
			<input
				type="checkbox"
				name={`payload_json_${field}`}
				value="null"
				checked={clearPreserved(field)}
				class="size-4 accent-primary"
			/>
			Clear {fieldLabel(field).toLowerCase()}
		</label>
	{/if}
{/snippet}

<form
	bind:this={formElement}
	method="POST"
	{action}
	use:enhance={enhanceSubmit}
	class="space-y-3"
	data-command={command}
>
	<input type="hidden" name="command" value={command} />
	<input type="hidden" name="confirmation_contract" value="dialog-v1" />
	<input type="hidden" name="confirmed" value={confirmed ? 'yes' : ''} />
	{#if targetId}<input type="hidden" name="target_id" value={targetId} />{/if}
	{#if expectedVersion !== undefined}
		<input type="hidden" name="expected_version" value={expectedVersion} />
	{/if}
	{#each Object.entries(presetValues) as [field, value] (field)}
		{@const hint = fieldHint(field)}
		<input
			type="hidden"
			name={`${hint.kind === 'json' ? 'payload_json_' : 'payload_'}${field}`}
			{value}
		/>
	{/each}

	{#if !compact}
		<div class="space-y-1">
			<p class="font-medium text-on-surface">{commandLabel(command)}</p>
			<p class="text-[length:var(--text-label)] leading-relaxed text-on-surface-variant">
				{commandSummary(command)}
			</p>
		</div>
	{/if}

	{#if disabled && disabledReason}
		<p
			class="rounded-[var(--md-sys-shape-corner-small)] bg-status-muted-bg px-3 py-2 text-[length:var(--text-label)] text-on-surface-variant"
		>
			{disabledReason}
		</p>
	{/if}

	{#each requiredFields as field (field)}
		{@render commandField(field, true)}
	{/each}

	{#if optionalFields.length}
		<Collapsible>
			<CollapsibleTrigger
				class="falcon-focus touch-target text-[length:var(--text-label)] font-semibold text-primary hover:text-primary/80"
			>
				More options
			</CollapsibleTrigger>
			<CollapsibleContent class="space-y-3 pt-3">
				{#each optionalFields as field (field)}
					{@render commandField(field, false)}
				{/each}
			</CollapsibleContent>
		</Collapsible>
	{/if}

	<Button
		type="submit"
		variant={destructive ? 'destructive' : 'default'}
		class="touch-target"
		disabled={disabled || submitting}
	>
		{submitting ? 'Working…' : commandLabel(command)}
	</Button>
</form>

<ConfirmDialog
	bind:open={confirmationOpen}
	title={`${commandLabel(command)}?`}
	description="This semantic action is consequential and will be recorded in Work history."
	confirmLabel={commandLabel(command)}
	{destructive}
	busy={submitting}
	onconfirm={confirm}
>
	{#if confirmationDetails.length}
		<dl class="space-y-2 rounded-[var(--md-sys-shape-corner-medium)] bg-surface-container-high p-3">
			{#each confirmationDetails as detail (detail.label)}
				<div class="grid gap-1 text-[length:var(--text-label)] sm:grid-cols-[7rem_1fr]">
					<dt class="font-semibold text-on-surface-variant">{detail.label}</dt>
					<dd class="whitespace-pre-wrap text-on-surface">{detail.value}</dd>
				</div>
			{/each}
		</dl>
	{/if}
</ConfirmDialog>
