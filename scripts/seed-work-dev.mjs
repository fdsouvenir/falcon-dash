#!/usr/bin/env node

const baseUrl = process.env.FALCON_DASH_DEV_URL ?? 'http://127.0.0.1:5173';
const force = process.argv.includes('--force');
const prefix = 'Dev:';

const categories = [
	{
		title: 'Personal',
		description: 'Personal priorities, family, travel, health, and money.',
		subcategories: ['Family', 'Health', 'Money', 'Travel']
	},
	{
		title: 'Work',
		description: 'Client work, product, revenue, and operating rhythms.',
		subcategories: ['Client delivery', 'Operations', 'Product', 'Revenue']
	},
	{
		title: 'Condo',
		description: 'HOA, maintenance, finance, and building documents.',
		subcategories: ['Documents', 'Finance', 'HOA', 'Maintenance']
	}
];

async function main() {
	await assertServer();
	const existing = await listItems(true);
	const seeded = existing.filter((item) => item.title?.startsWith(prefix));
	const activeSeeded = seeded.filter(
		(item) => !['complete', 'cancelled', 'archived'].includes(item.status)
	);

	if (activeSeeded.length && !force) {
		console.log(`Work dev data already has ${activeSeeded.length} active ${prefix} records.`);
		console.log('Run with --force to archive and recreate them.');
		return;
	}

	if (force) {
		for (const item of seeded) {
			if (item.status !== 'archived') {
				await patchItem(item.id, { status: 'archived', actor: 'seed-work-dev' });
			}
		}
	}

	const categoryMap = await ensureCategories();
	const created = [];

	const acme = await createItem({
		type: 'project',
		title: `${prefix} Acme onboarding launch`,
		description: 'Launch Acme with a working operator dashboard and first-week support rhythm.',
		status: 'in_progress',
		priority: 'high',
		owner: 'Maya',
		area_id: categoryMap['Work / Client delivery'],
		goal: 'Acme operators can complete daily handoff without escalation.',
		definition_of_done:
			'Operator access is live, launch checklist is green, and first three requests complete without escalation.',
		why_it_matters: 'This becomes the reference onboarding pattern for similar August clients.',
		scope: 'Operator access, workflow setup, support handoff, and first-week launch monitoring.',
		non_scope: 'Custom integrations beyond the agreed intake form.',
		health: 'at_risk',
		operator: 'Maya',
		target_date: isoDaysFromNow(10),
		next_action: 'Confirm the current launch blocker'
	});
	created.push(acme);
	const acmeAccess = await createItem({
		type: 'milestone',
		parent_item_id: acme.id,
		title: `${prefix} Access and billing ready`,
		description: 'Operators can sign in and billing ownership is clear.',
		status: 'in_progress',
		due_date: isoDaysFromNow(3)
	});
	created.push(acmeAccess);
	const acmeInvite = await createItem({
		type: 'task',
		parent_item_id: acmeAccess.id,
		title: `${prefix} Request missing billing admin invite`,
		description: 'Ask Acme operations lead to send the billing admin invite.',
		status: 'blocked',
		waiting_on: 'external',
		priority: 'high',
		due_date: isoDaysFromNow(1),
		next_action: 'Ask Acme operations lead to send the billing admin invite'
	});
	created.push(acmeInvite);
	const acmeChecklist = await createItem({
		type: 'task',
		parent_item_id: acmeAccess.id,
		title: `${prefix} Confirm operator handoff checklist`,
		description: 'Review the handoff checklist with Maya before launch rehearsal.',
		status: 'ready',
		priority: 'normal',
		due_date: isoDaysFromNow(2),
		next_action: 'Walk Maya through the checklist gaps'
	});
	created.push(acmeChecklist);
	const acmeMetrics = await createItem({
		type: 'open_question',
		parent_item_id: acme.id,
		title: `${prefix} Should Friday summary include launch metrics?`,
		status: 'needs_review',
		waiting_on: 'operator',
		priority: 'normal',
		question_text: 'Should the Friday summary include launch metrics for Acme?',
		why_it_matters:
			'The answer changes what the operator reviews during the first-week support rhythm.',
		answerer: 'operator',
		next_action: 'Confirm whether launch metrics belong in the summary'
	});
	created.push(acmeMetrics);
	const acmeAutomation = await createItem({
		type: 'automation',
		parent_item_id: acme.id,
		title: `${prefix} Daily Acme launch sweep`,
		description: 'Check handoff health each morning during launch week.',
		status: 'scheduled',
		trigger_type: 'cron',
		schedule: '0 8 * * 1-5',
		next_run_at: unixDaysFromNow(1),
		next_action: 'Run the morning launch sweep'
	});
	created.push(acmeAutomation);
	const acmeFinding = await createItem({
		type: 'finding',
		parent_item_id: acme.id,
		title: `${prefix} Acme support path depends on billing owner`,
		description:
			'Billing owner identity is the only launch readiness gap still affecting support flow.',
		status: 'needs_review',
		finding_text: 'Billing owner identity is unresolved and affects escalation routing.',
		source_refs: ['dev-seed:acme-launch']
	});
	created.push(acmeFinding);
	await createBlocker({
		blocked_item_id: acmeInvite.id,
		blocker_source: 'external',
		external_label: 'Acme operations lead',
		reason: 'Acme has not sent the billing admin invite.',
		unblock_action: 'Ask Acme operations lead to send the billing admin invite.'
	});
	await patchItem(acme.id, { current_next_item_id: acmeInvite.id, actor: 'seed-work-dev' });

	const trip = await createItem({
		type: 'project',
		title: `${prefix} September family trip`,
		description: 'Choose the travel window, hold flights, and line up pet care.',
		status: 'planning',
		priority: 'normal',
		owner: 'Fred',
		area_id: categoryMap['Personal / Travel'],
		goal: 'Book the family trip without leaving logistics to the last week.',
		definition_of_done: 'Flights are held, lodging is confirmed, and pet care is covered.',
		why_it_matters: 'The window affects school calendar, pet care, and flight cost.',
		scope: 'Dates, flights, lodging, pet care, and budget.',
		health: 'on_track',
		operator: 'Fred',
		target_date: isoDaysFromNow(21),
		next_action: 'Compare the two best flight windows'
	});
	created.push(trip);
	const tripPlan = await createItem({
		type: 'milestone',
		parent_item_id: trip.id,
		title: `${prefix} Dates and budget chosen`,
		description: 'Travel dates and spending ceiling are settled.',
		status: 'planning',
		due_date: isoDaysFromNow(7)
	});
	created.push(tripPlan);
	const tripFlights = await createItem({
		type: 'task',
		parent_item_id: tripPlan.id,
		title: `${prefix} Compare flight windows`,
		description: 'Compare Thursday and Saturday departures for cost and school-calendar fit.',
		status: 'ready',
		due_date: isoDaysFromNow(4),
		next_action: 'Price Thursday and Saturday departures'
	});
	created.push(tripFlights);
	const tripDecision = await createItem({
		type: 'decision',
		parent_item_id: trip.id,
		title: `${prefix} Pick Thursday or Saturday departure`,
		status: 'needs_review',
		waiting_on: 'operator',
		decision_question: 'Should the trip leave Thursday evening or Saturday morning?',
		options: ['Thursday evening', 'Saturday morning'],
		recommended_option: 'Saturday morning',
		consequence_of_no_decision: 'Flights may get more expensive and pet care cannot be finalized.',
		next_action: 'Choose the departure window'
	});
	created.push(tripDecision);
	await patchItem(trip.id, { current_next_item_id: tripFlights.id, actor: 'seed-work-dev' });

	const hoa = await createItem({
		type: 'project',
		title: `${prefix} HOA annual packet`,
		description:
			'Prepare notices, assessment policy notes, and maintenance questions for the board packet.',
		status: 'in_progress',
		priority: 'normal',
		owner: 'Fred',
		area_id: categoryMap['Condo / HOA'],
		goal: 'Send a clean board packet with no missing policy context.',
		definition_of_done:
			'Notices are reviewed, open questions are sent, and assessment notes are ready.',
		why_it_matters:
			'The packet sets up the next board meeting and avoids last-minute document cleanup.',
		scope: 'Board notices, assessment policies, maintenance questions, and document review.',
		health: 'on_track',
		operator: 'Fred',
		target_date: isoDaysFromNow(14),
		next_action: 'Review the newest board notices'
	});
	created.push(hoa);
	const hoaDocs = await createItem({
		type: 'milestone',
		parent_item_id: hoa.id,
		title: `${prefix} Board packet assembled`,
		description: 'Documents and open questions are ready for board review.',
		status: 'in_progress',
		due_date: isoDaysFromNow(6)
	});
	created.push(hoaDocs);
	const hoaNotices = await createItem({
		type: 'task',
		parent_item_id: hoaDocs.id,
		title: `${prefix} Review board notices`,
		description: 'Scan the latest board notices for policy changes and missing attachments.',
		status: 'in_progress',
		due_date: isoDaysFromNow(2),
		next_action: 'Check whether the assessment notice references the right policy'
	});
	created.push(hoaNotices);
	const hoaQuestion = await createItem({
		type: 'open_question',
		parent_item_id: hoa.id,
		title: `${prefix} Who owns the elevator maintenance reply?`,
		status: 'waiting',
		waiting_on: 'external',
		question_text: 'Who owns the elevator maintenance reply?',
		why_it_matters: 'The board packet should not send an ownerless maintenance question.',
		answerer: 'property manager',
		blocked_item_id: hoaDocs.id,
		next_action: 'Ask the property manager who owns the reply'
	});
	created.push(hoaQuestion);
	await patchItem(hoa.id, { current_next_item_id: hoaNotices.id, actor: 'seed-work-dev' });

	const workModel = await createItem({
		type: 'project',
		title: `${prefix} Work task model rollout`,
		description: 'Finish the task/pointer model cleanup and verify agents use the new language.',
		status: 'in_progress',
		priority: 'high',
		owner: 'agent',
		area_id: categoryMap['Work / Product'],
		goal: 'Work speaks task and project next-up pointer consistently.',
		definition_of_done: 'Docs, generated context, tests, and UI all use task terminology.',
		why_it_matters: 'It keeps the Work model from becoming a renamed task tracker again.',
		scope: 'Work API, project UI, docs, context, and validation coverage.',
		health: 'on_track',
		operator: 'Fred',
		target_date: isoDaysFromNow(5),
		next_action: 'Review the task pointer migration behavior'
	});
	created.push(workModel);
	const workModelChange = await createItem({
		type: 'change_request',
		parent_item_id: workModel.id,
		title: `${prefix} Verify task pointer migration`,
		description:
			'Confirm old next-step data upgrades to tasks without losing IDs or blocker links.',
		status: 'needs_review',
		priority: 'high',
		waiting_on: 'operator',
		change_scope: 'Work schema migration and API terminology',
		systems_touched: ['work.db', '/api/work/items', 'Work UI'],
		risk: 'Old local Work databases could fail to migrate if compatibility paths regress.',
		verification_plan:
			'Run Work unit tests, Work Playwright coverage, and inspect active dev data.',
		next_action: 'Review migration test coverage'
	});
	created.push(workModelChange);
	await patchItem(workModel.id, {
		current_next_item_id: workModelChange.id,
		actor: 'seed-work-dev'
	});

	console.log(`Seeded ${created.length} active Work records at ${baseUrl}.`);
	console.log('Open /work/projects or /work/tasks to review the dev data.');
}

async function assertServer() {
	const response = await fetch(`${baseUrl}/api/work/items?limit=1`);
	if (!response.ok) {
		throw new Error(`Falcon Dash dev server is not responding at ${baseUrl}`);
	}
}

async function ensureCategories() {
	const response = await fetch(`${baseUrl}/api/work/categories`);
	if (!response.ok) throw new Error(`Failed to list categories: ${response.status}`);
	let records = (await response.json()).all ?? [];
	const byTitle = new Map(records.map((category) => [category.title, category]));

	for (const category of categories) {
		let parent = byTitle.get(category.title);
		if (!parent) {
			parent = await createCategory({
				kind: 'category',
				title: category.title,
				description: category.description
			});
			records.push(parent);
			byTitle.set(parent.title, parent);
		}
		for (const subcategoryTitle of category.subcategories) {
			const existing = records.find(
				(record) => record.title === subcategoryTitle && record.parent_category_id === parent.id
			);
			if (!existing) {
				const child = await createCategory({
					kind: 'subcategory',
					parent_category_id: parent.id,
					title: subcategoryTitle,
					description: `${subcategoryTitle} work inside ${category.title}.`
				});
				records.push(child);
			}
		}
	}

	return Object.fromEntries(
		records
			.filter((record) => record.parent_category_id)
			.map((record) => {
				const parent = records.find((candidate) => candidate.id === record.parent_category_id);
				return [`${parent?.title} / ${record.title}`, record.id];
			})
	);
}

async function listItems(includeClosed = false) {
	const response = await fetch(
		`${baseUrl}/api/work/items?includeClosed=${includeClosed ? 'true' : 'false'}&limit=500`
	);
	if (!response.ok) throw new Error(`Failed to list Work items: ${response.status}`);
	return (await response.json()).items ?? [];
}

async function createCategory(data) {
	const response = await post('/api/work/categories', data);
	return response;
}

async function createItem(data) {
	return post('/api/work/items', {
		...data,
		actor: 'seed-work-dev',
		source: 'dev-seed'
	});
}

async function patchItem(id, data) {
	const response = await fetch(`${baseUrl}/api/work/items/${id}`, {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ ...data, source: 'dev-seed' })
	});
	if (!response.ok) {
		throw new Error(
			`PATCH /api/work/items/${id} failed: ${response.status} ${await response.text()}`
		);
	}
	return response.json();
}

async function createBlocker(data) {
	return post('/api/work/blockers', {
		...data,
		actor: 'seed-work-dev',
		source: 'dev-seed'
	});
}

async function post(path, data) {
	const response = await fetch(`${baseUrl}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(data)
	});
	if (!response.ok) {
		throw new Error(`POST ${path} failed: ${response.status} ${await response.text()}`);
	}
	return response.json();
}

function isoDaysFromNow(days) {
	return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function unixDaysFromNow(days) {
	return Math.floor((Date.now() + days * 24 * 60 * 60 * 1000) / 1000);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
