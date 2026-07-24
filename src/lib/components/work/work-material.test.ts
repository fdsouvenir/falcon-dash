// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const componentDirectory = new URL('./', import.meta.url);
const componentSources = readdirSync(componentDirectory)
	.filter((name) => name.endsWith('.svelte'))
	.map((name) => ({ name, source: readFileSync(new URL(name, componentDirectory), 'utf-8') }));
const workRouteDirectory = new URL('../../../routes/work/', import.meta.url);
const routeSources = (readdirSync(workRouteDirectory, { recursive: true }) as string[])
	.filter((name) => name.endsWith('.svelte'))
	.map((name) => ({
		name: `routes/work/${name}`,
		source: readFileSync(new URL(name, workRouteDirectory), 'utf-8')
	}));

describe('Work UI material guardrails', () => {
	it('uses semantic colors and restrained effects throughout every Work surface', () => {
		for (const surface of [...componentSources, ...routeSources]) {
			expect(surface.source, surface.name).not.toMatch(
				/(?:text|bg|border)-(?:blue|emerald|red|amber|sky)-\d/
			);
			expect(surface.source, surface.name).not.toContain('transition-all');
			expect(surface.source, surface.name).not.toContain('shadow-sm');
		}
	});

	it('keeps shared panel surfaces tonal', () => {
		for (const name of ['CommandBar.svelte', 'Section.svelte', 'StatTile.svelte']) {
			const component = componentSources.find((entry) => entry.name === name);
			expect(component?.source).toContain('bg-surface-container');
			expect(component?.source).toContain('shadow-none');
		}
	});

	it('keeps semantic command forms manifest-driven and conflict-safe', () => {
		const form = componentSources.find((entry) => entry.name === 'CommandForm.svelte')?.source;
		const feedback = componentSources.find(
			(entry) => entry.name === 'CommandFeedback.svelte'
		)?.source;

		expect(form).toContain('commandMeta(command)');
		expect(form).toContain('payload_json_');
		expect(form).toContain('form.values');
		expect(form).toContain('formMatchesPreset');
		expect(form).toContain('form.values?.target_id !== targetId');
		expect(form).toContain('requireAnyOf');
		expect(form).toContain('requireExactlyOneOf');
		expect(form).toContain('hasConditionalValue');
		expect(form).toContain('setCustomValidity');
		expect(form).toContain('Provide at least one');
		expect(form).toContain('Provide exactly one');
		expect(form).toContain('new Date(value).getTime()');
		expect(form).toContain('formData.set(`display_${field}`, value)');
		expect(form).toContain('formData.set(key, String(epoch))');
		expect(form).toContain('name="confirmation_contract"');
		expect(form).toContain('name="confirmed"');
		expect(form).toContain('ConfirmDialog');
		expect(form).toContain('resolveConfirmation');
		expect(form).toContain('await update()');
		const commandBar = componentSources.find((entry) => entry.name === 'CommandBar.svelte')?.source;
		const workItemRow = componentSources.find(
			(entry) => entry.name === 'WorkItemRow.svelte'
		)?.source;
		expect(commandBar).toContain('const commandBarId = $props.id()');
		expect(commandBar).toContain('aria-labelledby={commandBarTitleId}');
		expect(commandBar).not.toContain('id="command-bar-title"');
		expect(workItemRow).toContain("type === 'change_request' ? 'change_execution' : type");
		expect(feedback).toContain("form.error.code === 'version_conflict'");
		expect(feedback).toContain('invalidateAll');
	});

	it('routes consequential legacy actions through the confirmation-aware form', () => {
		const routes = {
			question: readFileSync(
				new URL('../../../routes/work/questions/[id]/+page.svelte', import.meta.url),
				'utf-8'
			),
			decision: readFileSync(
				new URL('../../../routes/work/decisions/[id]/+page.svelte', import.meta.url),
				'utf-8'
			),
			project: readFileSync(
				new URL('../../../routes/work/projects/[id]/+page.svelte', import.meta.url),
				'utf-8'
			),
			change: readFileSync(
				new URL('../../../routes/work/changes/[id]/+page.svelte', import.meta.url),
				'utf-8'
			),
			finding: readFileSync(
				new URL('../../../routes/work/findings/[id]/+page.svelte', import.meta.url),
				'utf-8'
			),
			task: readFileSync(
				new URL('../../../routes/work/tasks/[id]/+page.svelte', import.meta.url),
				'utf-8'
			)
		};

		for (const [name, source] of Object.entries(routes)) {
			expect(source, name).toContain('<CommandFeedback');
			expect(source, name).toContain('<CommandBar');
			expect(source, name).toContain('<PageHeader');
			expect(source, name).not.toMatch(/(?:text|bg|border)-(?:blue|emerald|red|amber|sky)-\d/);
			expect(source, name).not.toContain('transition-all');
			expect(source, name).not.toContain('shadow-sm');
		}
		expect(routes.question).not.toMatch(
			/value="(?:answer_question|revise_answer|withdraw_question)"/
		);
		expect(routes.question).toContain('parseQuestionSections');
		expect(routes.question).toContain("question.status === 'answered'");
		expect(routes.question).toContain("'Retained answer'");
		expect(routes.question).toContain("'Latest retained'");
		expect(routes.question).toContain('answer_history ?? [])].reverse()');
		expect(routes.decision).not.toMatch(/value="(?:decide|withdraw_decision)"/);
		expect(routes.decision).toContain('<CommandForm');
		expect(routes.decision).toContain('choiceFields={optionChoices}');
		expect(routes.change).not.toContain('<form');
		expect(routes.change).toContain("guarded('start_change', 'Start')");
		expect(routes.change).toContain("guarded('succeed_execution', 'Complete')");
		expect(routes.change).toContain('unavailable — Authorization ${authorizationState}');
		expect(routes.change).toContain(
			'Evaluations of quality and readiness — never execution authority.'
		);
		expect(routes.change).toContain('authorization.scope_fingerprint');
		expect(routes.change).toContain('authorization.conditions');
		expect(routes.change).toContain('review.submitted_at');
		expect(routes.change).toContain('if (rollbackInProgress) return []');
		expect(routes.finding).not.toContain('value="retract_finding"');
		expect(routes.finding).toContain('<SourceRefs');
		expect(routes.project).toContain('<CommandForm');
		expect(routes.project).not.toContain('<form');
		expect(routes.project).toContain('xl:grid-cols-[14rem_minmax(0,1fr)_23rem]');
		for (const section of ['status', 'route', 'proof', 'current-work', 'history']) {
			expect(routes.project).toContain(`id="${section}"`);
		}
		expect(routes.project).toContain('Add phase');
		expect(routes.project).toContain('Add milestone');
		expect(routes.project).toContain('Waive under authority');
		expect(routes.project).toContain('Contributes');
		expect(routes.project).toContain('Satisfies');
		expect(routes.project).toContain('Criterion contribution sources');
		expect(routes.project).toContain('Milestone contribution sources');
		expect(routes.project).toContain('Historical achievement sources');
		expect(routes.project).toContain('Historical satisfactions');
		expect(routes.project).toContain('Archived Projects do not have a current next item');
		expect(routes.project).toContain('Reopen the Project before choosing work');
		expect(routes.project).toContain('!terminalProject && project.current_next_valid');
		expect(routes.project).toContain("project.archived ? 'Saved current next' : 'Current next'");
		expect(routes.project).toContain('project.current_next_item_id && !project.archived');
		expect(routes.project).toContain("milestone.status === 'achieved'");
		expect(routes.project).toContain('requireExactlyOneOfByCommand');
		expect(routes.project).toContain('enabled: phase.open_work === 0');
		expect(routes.project).toContain('must finish first');
		expect(routes.project).toContain('enabled: phase.work_total > 0');
		expect(routes.project).toContain('Assign at least one work item before activation');
		expect(routes.project).toContain('Rollback in progress since');
		expect(routes.project).toContain('Rollback completed');
		expect(routes.project).toContain('Project contributions');
		expect(routes.project).toContain('Clear invalid current next item');

		const questionLoader = readFileSync(
			new URL('../../../routes/work/questions/[id]/+page.server.ts', import.meta.url),
			'utf-8'
		);
		expect(questionLoader).toContain('resolveWork3SourceRefs');
		expect(questionLoader).toContain('answerSources');
		expect(questionLoader).toContain('answerSourcesOmitted');
		const projectLoader = readFileSync(
			new URL('../../../routes/work/projects/[id]/+page.server.ts', import.meta.url),
			'utf-8'
		);
		expect(projectLoader).toContain('resolveProjectProofSources');
		expect(routes.project).toContain('milestone.source_refs_omitted ?? 0');
	});

	it('renders source availability explicitly', () => {
		const sourceRefs = componentSources.find((entry) => entry.name === 'SourceRefs.svelte')?.source;
		const timeline = componentSources.find((entry) => entry.name === 'Timeline.svelte')?.source;
		expect(sourceRefs).toContain('source.available === true');
		expect(sourceRefs).toContain('source.available === false');
		expect(sourceRefs).toContain('source.reason');
		expect(timeline).toContain('event.authority_act');
		expect(timeline).toContain('Evidence · {sources.join');
	});

	it('routes automaton mutations through the confirmation-aware form', () => {
		const automaton = readFileSync(
			new URL('../../../routes/work/automations/[id]/+page.svelte', import.meta.url),
			'utf-8'
		);
		expect(automaton).toContain('<CommandForm');
		expect(automaton).not.toContain('<form');
		expect(automaton).not.toContain('window.confirm');
	});

	it('keeps focus, resolution, and Browse contracts centralized', () => {
		const focusChips = componentSources.find((entry) => entry.name === 'FocusChips.svelte')?.source;
		const browse = readFileSync(
			new URL('../../../routes/work/browse/+page.svelte', import.meta.url)
		);
		const resolution = readFileSync(
			new URL('../../../routes/work/needs-resolution/+page.svelte', import.meta.url)
		);

		expect(focusChips).toContain('focusDefinitionsForType');
		expect(focusChips).toContain("params.set('focus', focus)");
		expect(browse.toString()).toContain('<FocusChips');
		expect(browse.toString()).toContain('Terminal and archived');
		expect(browse.toString()).not.toContain('create_task');
		expect(browse.toString()).not.toContain('create_area');
		for (const section of ['Questions', 'Decisions', 'Reviews', 'Authorizations']) {
			expect(resolution.toString()).toContain('title={`' + section + ' (');
		}
		expect(resolution.toString()).toContain('Review does not grant execution authority');
		expect(resolution.toString()).toContain('This is not Review');
	});

	it('keeps mobile Work actions compact, touch-safe, and sheet-based', () => {
		const commandBar = componentSources.find((entry) => entry.name === 'CommandBar.svelte')?.source;
		const pageHeader = componentSources.find((entry) => entry.name === 'PageHeader.svelte')?.source;
		const layout = readFileSync(new URL('../../../routes/work/+layout.svelte', import.meta.url));
		const overview = readFileSync(new URL('../../../routes/work/+page.svelte', import.meta.url));
		const projects = readFileSync(
			new URL('../../../routes/work/projects/+page.svelte', import.meta.url)
		);
		const automata = readFileSync(
			new URL('../../../routes/work/automations/+page.svelte', import.meta.url)
		);

		expect(commandBar).toContain('BottomSheet');
		expect(commandBar).toContain('isMobile');
		expect(commandBar).toContain('data-command-bar-mobile');
		expect(commandBar).toContain('data-command-sheet');
		expect(commandBar).toContain('class="sticky bottom-[');
		expect(commandBar).toContain('formCommand');
		expect(commandBar).toContain('formMatchesItem');
		expect(commandBar).toContain('values?.target_id !== targetId');
		expect(pageHeader).toContain('break-all');
		expect(layout.toString()).toContain('var(--safe-left)');
		expect(layout.toString()).toContain('var(--safe-right)');
		for (const source of [projects, automata]) {
			expect(source.toString()).toContain('grid grid-cols-2 gap-3');
		}
		// The overview is inbox-first: no stat tiles, counts live inline in section headings.
		expect(overview.toString()).not.toContain('StatTile');
		expect(overview.toString()).toContain('sr-only');
	});
});
