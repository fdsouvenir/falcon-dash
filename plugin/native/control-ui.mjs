import { defineControlUiPlugin } from 'openclaw/plugin-sdk/control-ui';
import { createFeatureClient } from 'openclaw/plugin-sdk/feature-contract';
import { workFeature, commandInputs } from '../work/feature-contract.mjs';
import { ViewLifetime, message } from './lifetime.mjs';
import './style.css';
import { documentPreview } from './markdown.mjs';
const names = {
	work: 'Work',
	integrations: 'Integrations',
	vault: 'Vault',
	documents: 'Documents'
};
const human = (s) =>
	String(s ?? '')
		.replaceAll('_', ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
function el(tag, text, attrs = {}) {
	const n = document.createElement(tag);
	if (text !== null && text !== undefined) n.textContent = String(text);
	for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
	return n;
}
function button(label, run, kind = '') {
	const b = el('button', label, { type: 'button', class: kind });
	b.addEventListener('click', run);
	return b;
}
function field(label, { value = '', type = 'text', multiline = false, options } = {}) {
	const wrap = el('label', null, { class: 'field' });
	wrap.append(el('span', label));
	const input = options ? el('select') : el(multiline ? 'textarea' : 'input');
	if (options)
		for (const option of options) {
			const [value, text] = Array.isArray(option) ? option : [option, human(option)];
			input.append(el('option', text, { value }));
		}
	else if (!multiline) input.type = type;
	input.value =
		options && value === '' ? (Array.isArray(options[0]) ? options[0][0] : options[0]) : value;
	wrap.append(input);
	return { wrap, input };
}
function paragraph(parent, text, cls = '') {
	parent.append(el('p', text, { class: cls }));
}
function renderValue(value, depth = 0) {
	if (value == null) return el('span', 'Not set');
	if (typeof value !== 'object') return el('p', String(value), { class: 'prose' });
	if (depth > 6) return el('p', 'Additional nested context is available in full history.');
	if (Array.isArray(value)) {
		const list = el('ul', null, { class: 'structured-list' });
		for (const item of value.slice(0, 100)) {
			const li = el('li');
			li.append(renderValue(item, depth + 1));
			list.append(li);
		}
		if (!value.length) list.append(el('li', 'None'));
		return list;
	}
	const list = el('dl', null, { class: 'structured-details' });
	for (const [key, item] of Object.entries(value)) {
		if (['task_id', 'definition_id', 'created_at', 'updated_at', 'version', 'id'].includes(key)) {
			const detail = el('details');
			detail.append(el('summary', human(key)), renderValue(item, depth + 1));
			list.append(detail);
			continue;
		}
		list.append(el('dt', human(key)));
		const dd = el('dd');
		if (['ref', 'url'].includes(key) && typeof item === 'string' && /^https:\/\//i.test(item)) {
			const link = el('a', item, { href: item, target: '_blank', rel: 'noopener noreferrer' });
			dd.append(link);
		} else dd.append(renderValue(item, depth + 1));
		list.append(dd);
	}
	return list;
}
function detailText(parent, label, value) {
	if (value == null) return;
	const section = el('section', null, { class: 'detail-section' });
	section.append(el('h3', label), renderValue(value));
	parent.append(section);
}

function schemaEditor(schema, label, value) {
	if ('const' in schema)
		return { node: el('p', `${label}: ${human(schema.const)}`), read: () => schema.const };
	const enums = schema.anyOf?.filter((s) => 'const' in s);
	if (enums?.length === schema.anyOf?.length && enums?.length) {
		const f = field(label, {
			value: value == null ? '' : String(value),
			options: enums.map((s) => [String(s.const), human(s.const)])
		});
		return {
			node: f.wrap,
			read: () => enums.find((s) => String(s.const) === f.input.value)?.const
		};
	}
	if (schema.anyOf) {
		const nonnull = schema.anyOf.find((s) => s.type !== 'null');
		if (schema.anyOf.some((s) => s.type === 'null')) {
			const f = field(label + ' (leave blank for none)', { value: value ?? '' });
			return { node: f.wrap, read: () => f.input.value || null };
		}
		return schemaEditor(nonnull, label, value);
	}
	if (schema.type === 'object' && schema.properties) {
		const node = el('fieldset');
		node.append(el('legend', label));
		const parts = {};
		for (const [key, child] of Object.entries(schema.properties)) {
			parts[key] = schemaEditor(
				child,
				human(key) + (schema.required?.includes(key) ? ' *' : ''),
				value?.[key]
			);
			node.append(parts[key].node);
		}
		return {
			node,
			read: () => {
				const out = {};
				for (const [k, part] of Object.entries(parts)) {
					const v = part.read();
					if (v === '' && !schema.required?.includes(k)) continue;
					out[k] = v;
				}
				return out;
			}
		};
	}
	if (schema.type === 'object') {
		const node = el('fieldset'),
			pairs = [];
		node.append(el('legend', label));
		const add = () => {
			const row = el('div', null, { class: 'toolbar' }),
				key = field('Work ID'),
				val = schemaEditor(
					Object.values(schema.patternProperties ?? {})[0] ?? { type: 'string' },
					'Value'
				);
			row.append(
				key.wrap,
				val.node,
				button('Remove', () => {
					row.remove();
					pairs.splice(
						pairs.findIndex((p) => p.row === row),
						1
					);
				})
			);
			pairs.push({ row, key, val });
			node.append(row);
		};
		node.append(button('Add disposition', add));
		return {
			node,
			read: () => Object.fromEntries(pairs.map((p) => [p.key.input.value, p.val.read()]))
		};
	}
	if (schema.type === 'array') {
		const node = el('fieldset'),
			items = [];
		node.append(el('legend', label));
		const add = (value) => {
			if (items.length >= (schema.maxItems ?? 50)) return;
			const part = schemaEditor(schema.items, 'Item', value),
				row = el('div', null, { class: 'array-item' });
			row.append(
				part.node,
				button('Remove item', () => {
					row.remove();
					items.splice(items.indexOf(part), 1);
				})
			);
			items.push(part);
			node.append(row);
		};
		node.append(button('Add item', () => add()));
		for (const item of value ?? []) add(item);
		return { node, read: () => items.map((p) => p.read()) };
	}
	if (schema.type === 'boolean') {
		const f = field(label, {
			value: value ? 'true' : 'false',
			options: [
				['false', 'No'],
				['true', 'Yes']
			]
		});
		return { node: f.wrap, read: () => f.input.value === 'true' };
	}
	const f = field(label, {
		value: value ?? '',
		type: schema.type === 'integer' ? 'number' : 'text',
		multiline: (schema.maxLength ?? 0) > 1000
	});
	if (schema.maxLength) f.input.maxLength = schema.maxLength;
	f.input.required = label.endsWith(' *');
	return {
		node: f.wrap,
		read: () => (schema.type === 'integer' ? Number(f.input.value) : f.input.value)
	};
}

function mount(container, context, module) {
	const host = context.host,
		life = new ViewLifetime(context.signal),
		feature = createFeatureClient(workFeature, host);
	const root = el('main', null, { class: 'falcon-native' });
	container.append(root);
	const header = el('header'),
		heading = el('h1', names[module]),
		status = el('p', 'Loading…', { role: 'status', class: 'status' }),
		body = el('div', null, { class: 'workspace' });
	header.append(heading);
	root.append(header, status, body);
	const toolbar = el('div', null, { class: 'toolbar' });
	header.append(toolbar);
	const displayError = (error) => {
		status.textContent = message(error);
		status.setAttribute('role', 'alert');
	};
	let selected = null,
		refresh = async () => {},
		refreshTimer,
		busy = false,
		scope = 'attention',
		agentFilter = '',
		browseType = '',
		workOffset = 0,
		query = '',
		rootId = '',
		directory = '',
		file = null,
		docDraft = null;
	let refreshAfterReconnect = false;
	const protect = async (action) => {
		if (busy || life.dead) return;
		busy = true;
		root.setAttribute('aria-busy', 'true');
		try {
			await action();
		} catch (error) {
			if (!life.dead) displayError(error);
		} finally {
			busy = false;
			root.removeAttribute('aria-busy');
			if (refreshAfterReconnect && !life.dead && host.connection.connected) {
				refreshAfterReconnect = false;
				queueMicrotask(() => protect(refresh));
			}
		}
	};
	const rpc = (action, input = {}) => {
		context.signal.throwIfAborted();
		return host.request('falcon.vault.protected', { action, input });
	};
	const request = (mod, action, input = {}, write = false) =>
		host.request(`falcon.${mod}.${write ? 'write' : 'read'}`, { action, ...input });
	const secretNodes = new Set();
	let secretRevision = 0;
	const secretTicket = () => {
		const revision = ++secretRevision;
		const valid = life.ticket();
		return () => valid() && revision === secretRevision;
	};
	const clearSecrets = () => {
		secretRevision++;
		secretNodes.forEach((n) => {
			if ('value' in n) n.value = '';
			else n.textContent = '';
		});
	};
	life.own(clearSecrets);
	const selectedFiles = new Set(),
		lastTrash = [];
	let documentSearch = '',
		documentSort = 'name',
		documentNotice = '';
	let consentUrl,
		dialog,
		vaultEpoch,
		vaultGroup = '';
	function closeDialog() {
		clearSecrets();
		dialog?.dispose();
		dialog = null;
	}

	function form(title, fields, submit, { protectedEntry = false, submitLabel = 'Save' } = {}) {
		closeDialog();
		const content = el('form', null, { class: 'falcon-native' }),
			inputs = {};
		for (const [key, options] of Object.entries(fields)) {
			const f = field(options.label ?? human(key), options);
			inputs[key] = f.input;
			if (protectedEntry && options.type === 'password') {
				f.input.setAttribute('data-secret', 'entry');
				secretNodes.add(f.input);
				f.input.autocomplete = 'new-password';
			}
			content.append(f.wrap);
		}
		const error = el('p', '', { role: 'alert' }),
			save = el('button', submitLabel, { type: 'submit', class: 'primary' });
		content.append(error, save, button('Cancel', closeDialog));
		content.addEventListener('submit', async (event) => {
			event.preventDefault();
			if (save.disabled) return;
			save.disabled = true;
			try {
				const values = Object.fromEntries(Object.entries(inputs).map(([k, n]) => [k, n.value]));
				await submit(values);
				if (!life.dead) {
					closeDialog();
					await refresh();
				}
			} catch (e) {
				error.textContent = message(e);
			} finally {
				save.disabled = false;
			}
		});
		dialog = host.components.mountDialog(root, {
			label: title,
			content,
			onCancel: () => {
				if (save.disabled) return false;
				closeDialog();
			}
		});
	}
	function confirm(label, run) {
		form(label, {}, run, { submitLabel: 'Confirm' });
	}
	function row(record, open) {
		const b = button('', () => protect(open), 'record');
		const identity = el('span', null, { class: 'identity' });
		identity.append(
			el('span', human(record.type ?? record.provider ?? 'File'), { class: 'kind' }),
			el('strong', record.title ?? record.purpose ?? record.id ?? record.name),
			el('small', record.id ?? '')
		);
		b.append(
			identity,
			el('span', human(record.status ?? record.health ?? record.kind ?? ''), { class: 'state' })
		);
		if (record.attention?.length)
			b.append(
				el('span', record.attention.map((w) => human(w.code)).join(' · '), { class: 'attention' })
			);
		return b;
	}
	async function command(target, command, input, idempotencyKey = crypto.randomUUID()) {
		await host.request('falcon.identity', {});
		await feature.invoke('work_command', {
			command,
			id: target?.id,
			expected_version: target?.version,
			idempotency_key: idempotencyKey,
			input
		});
	}
	function semanticForm(title, schema, initial, submit, target = null) {
		closeDialog();
		const editor = schemaEditor(schema, title, initial),
			content = el('form', null, { class: 'falcon-native' }),
			error = el('p', '', { role: 'alert' }),
			save = el('button', 'Save', { type: 'submit', class: 'primary' });
		content.append(editor.node, error, save, button('Cancel', closeDialog));
		const recovery = el('div', null, { class: 'toolbar' });
		recovery.hidden = true;
		if (target)
			recovery.append(
				button('Review current record', async () => {
					try {
						const latest = await request('work', 'get', { id: target.id });
						if (life.dead) return;
						detailText(content, 'Latest saved record', latest);
						recovery.append(
							button('Use current version for this draft', () => {
								target.version = latest.version;
								error.textContent =
									'Your draft is unchanged. Review its referenced versions before saving.';
							})
						);
					} catch (e) {
						error.textContent = message(e);
					}
				})
			);
		content.append(recovery);

		content.onsubmit = async (e) => {
			e.preventDefault();
			if (save.disabled) return;
			save.disabled = true;
			try {
				await submit(editor.read());
				if (!life.dead) {
					closeDialog();
					await refresh();
				}
			} catch (e) {
				error.textContent = message(e);
				recovery.hidden = false;
			} finally {
				save.disabled = false;
			}
		};
		dialog = host.components.mountDialog(root, {
			label: title,
			content,
			onCancel: () => {
				if (save.disabled) return false;
				closeDialog();
			}
		});
	}
	function commandForm(target, name) {
		const nonce = crypto.randomUUID();
		const initial = { ...target, ...(target?.definition?.content ?? {}) };
		semanticForm(
			human(name),
			commandInputs[name],
			initial,
			(input) => command(target, name, input, nonce),
			target
		);
	}
	function createWork() {
		form(
			'Choose work type',
			{
				type: {
					options: ['task', 'project', 'area', 'question', 'finding', 'decision', 'milestone']
				}
			},
			async (v) => {
				setTimeout(() => {
					if (life.dead) return;
					const schema = commandInputs.create.anyOf.find((s) => s.properties.type.const === v.type);
					const nonce = crypto.randomUUID();
					semanticForm('Create ' + human(v.type), schema, { type: v.type }, (input) =>
						command(null, 'create', input, nonce)
					);
				});
			}
		);
	}

	async function workDetail(id) {
		const valid = life.ticket(),
			record = await request('work', 'get', { id });
		if (!valid()) return;
		selected = record;
		body.replaceChildren();
		const back = button('Back to work', () =>
			protect(() => {
				selected = null;
				return refresh();
			})
		);
		body.append(
			back,
			el('h2', record.title),
			el('p', `${human(record.type)} · ${human(record.status)}`, { class: 'status' })
		);
		for (const warning of record.attention ?? [])
			paragraph(
				body,
				human(warning.code) + (warning.waiting_for ? `: ${warning.waiting_for}` : ''),
				'attention'
			);
		if (record.type === 'question')
			for (const key of ['prompt', 'context', 'impact', 'answerable_by'])
				detailText(body, human(key), record[key]);
		if (record.type === 'finding')
			for (const key of ['conclusion', 'confidence', 'targets'])
				detailText(body, human(key), record[key]);
		if (record.type === 'task')
			detailText(body, 'Accountable agent', record.agent_id ?? 'Unassigned');
		if (record.project_id)
			body.append(button('Open project', () => protect(() => workDetail(record.project_id))));
		for (const key of [
			'description',
			'done_when',
			'success_condition',
			'achievement',
			'definition',
			'plan',
			'result',
			'change',
			'authorization',
			'wait',
			'review_target',
			'answer',
			'package',
			'outcome',
			'hypothesis',
			'sources',
			'links',
			'milestones'
		])
			if (record[key] != null) detailText(body, human(key), record[key]);
		for (const child of record.associated_work ?? [])
			body.append(row(child, () => workDetail(child.id)));
		for (const ask of record.asks ?? []) {
			const section = el('section', null, { class: 'list-zone' });
			section.append(el('h2', ask.prompt));
			detailText(section, 'Missing requirement', ask.requirement);
			if (ask.thread)
				section.append(
					button('Open conversation', () =>
						host.sessions.open({ sessionKey: ask.thread.session_key, agentId: ask.thread.agent_id })
					)
				);
			body.append(section);
		}
		for (const relationship of record.relationships ?? []) {
			const other = relationship.source === id ? relationship.target : relationship.source;
			body.append(
				button(`${human(relationship.kind)} · ${other}`, () => protect(() => workDetail(other)))
			);
		}
		const actions = el('div', null, { class: 'toolbar' });
		body.append(actions);
		const common = ['ask', 'dismiss_ask', 'place'];
		const domain = {
			task: [
				'ready',
				'unready',
				'start',
				'wait',
				'resume',
				'complete',
				'reopen',
				'assign',
				'revise_definition',
				'revise_plan',
				'checkpoint',
				'revise_change',
				'authorize',
				'depends_on',
				'remove_dependency',
				'reaffirm_dependency',
				'review_target',
				'associate',
				'dissociate',
				'reaffirm_plan',
				'revoke_authorization',
				'abandon'
			],
			project: ['abandon'],
			milestone: ['achieve', 'reopen'],
			question: ['edit_question', 'answer', 'hypothesis', 'reopen'],
			finding: ['retract', 'supersede'],
			decision: ['decide', 'revise_decision', 'supersede_decision', 'defer', 'resume'],
			area: ['edit_area', 'archive', 'restore']
		};
		const choose = field('Action', {
			options: [
				['', 'Choose an action'],
				...[...(domain[record.type] ?? []), ...common]
					.filter((n) => commandInputs[n])
					.map((n) => [n, human(n)])
			]
		});
		actions.append(choose.wrap);
		choose.input.onchange = () => {
			if (choose.input.value) commandForm(record, choose.input.value);
		};
		actions.append(
			button('Load history', () =>
				protect(async () => {
					const data = await request('work', 'history', { id, query: { limit: 25 } });
					detailText(body, 'History', data);
				})
			)
		);
		status.textContent = 'Current record';
	}
	async function work() {
		if (selected) return workDetail(selected.id);
		const valid = life.ticket();
		const input = {
			limit: 50,
			offset: workOffset,
			...(agentFilter ? { agent_id: agentFilter } : {}),
			...(scope === 'browse' && browseType ? { type: browseType } : {}),
			...(query ? { search: query } : {}),
			...(scope === 'projects' ? { type: 'project' } : {})
		};
		const data =
			scope === 'attention'
				? await feature.invoke('work_queue', {
						limit: 15,
						...(agentFilter ? { agent_id: agentFilter } : {})
					})
				: await feature.invoke('work_list', input);
		if (!valid()) return;
		body.replaceChildren();
		if (data.buckets) {
			for (const [name, bucket] of Object.entries(data.buckets)) {
				if (!bucket.items.length) continue;
				const section = el('section', null, { class: 'list-zone' });
				section.append(el('h2', human(name)));
				for (const item of bucket.items) section.append(row(item, () => workDetail(item.id)));
				body.append(section);
			}
			if (!body.children.length) paragraph(body, 'Nothing needs attention.');
		} else {
			for (const item of data.items) body.append(row(item, () => workDetail(item.id)));
			if (!data.items.length) paragraph(body, 'No matching work.');
			if (workOffset > 0)
				body.append(
					button('Previous page', () =>
						protect(async () => {
							workOffset = Math.max(0, workOffset - 50);
							await refresh();
						})
					)
				);
			if (data.next_offset !== null && data.next_offset !== undefined)
				body.append(
					button('Next page', () =>
						protect(async () => {
							workOffset = data.next_offset;
							await refresh();
						})
					)
				);
			paragraph(
				body,
				`Showing ${data.items.length} of ${data.total ?? data.items.length} matching records.`,
				'status'
			);
		}
		status.textContent = 'Up to date';
	}
	async function vault() {
		const valid = life.ticket();
		clearSecrets();
		const state = await request('vault', 'status');
		if (!valid()) return;
		body.replaceChildren();
		vaultEpoch = state.epoch;
		status.textContent = state.locked ? 'Vault locked' : 'Vault unlocked';
		const actions = el('div', null, { class: 'toolbar' });
		body.append(actions);
		if (state.locked) {
			actions.append(
				button('Unlock', () =>
					protect(async () => {
						await rpc('unlock');
						await refresh();
					})
				),
				button('Set up Vault', () => confirm('Create encrypted Vault', () => rpc('initialize')))
			);
			paragraph(
				body,
				'Protected values stay in KeePassXC. Only configured human owners can manage this Vault.'
			);
			return;
		}
		actions.append(
			button('Lock Vault', () =>
				protect(async () => {
					clearSecrets();
					await rpc('lock');
					await refresh();
				})
			),
			button('Add credential', () =>
				form(
					'Add protected credential',
					{
						id: { label: 'Entry path' },
						field: { value: 'api_key', label: 'Credential field' },
						value: { type: 'password', label: 'Protected value' }
					},
					(v) => rpc('create', { id: v.id, material: { [v.field]: v.value } }),
					{ protectedEntry: true }
				)
			),
			button('New group', () =>
				form('New group', { id: { label: 'Group path' } }, (v) => rpc('group', v))
			)
		);
		const data = vaultGroup
			? await rpc('inventory', { group: vaultGroup })
			: await request('vault', 'inventory');
		if (!valid()) return;
		const entries = data.entries ?? [];
		if (vaultGroup)
			body.append(
				button('Parent group', () =>
					protect(async () => {
						vaultGroup = vaultGroup.split('/').slice(0, -1).join('/');
						await refresh();
					})
				)
			);
		for (const entry of entries) {
			if (entry.kind === 'group') {
				body.append(
					button(entry.id, () =>
						protect(async () => {
							vaultGroup = entry.id;
							await refresh();
						})
					)
				);
				continue;
			}
			const section = el('section', null, { class: 'list-zone' });
			section.append(el('h2', entry.id ?? entry.title));
			paragraph(
				section,
				entry.execution_disabled ? 'Agent execution disabled' : 'Values masked by default'
			);
			const controls = el('div', null, { class: 'toolbar' }),
				f = field('Field', { value: 'api_key' }),
				value = el('output', '', {
					'data-secret': 'revealed',
					'aria-label': 'Revealed credential'
				});
			secretNodes.add(value);
			controls.append(
				f.wrap,
				button('Reveal', () =>
					protect(async () => {
						clearSecrets();
						const ticket = secretTicket();
						const result = await rpc('reveal', { id: entry.id, field: f.input.value });
						if (ticket() && host.connection.connected) {
							value.textContent = result.value;
							setTimeout(() => {
								value.textContent = '';
							}, 15000);
						}
					})
				),
				button('Hide', () => {
					clearSecrets();
				}),
				button('Copy', () =>
					protect(async () => {
						const ticket = secretTicket();
						const result = await rpc('copy', { id: entry.id, field: f.input.value });
						if (ticket() && host.connection.connected) {
							await navigator.clipboard.writeText(result.value);
							status.textContent = 'Copied. Clipboard content remains until you replace it.';
						}
					})
				)
			);

			controls.append(
				button('Rotate or add field', () =>
					protect(async () => {
						const metadata = await request('vault', 'metadata', { id: entry.id });
						if (life.dead) return;
						form(
							'Rotate protected credential field',
							{
								field: { value: f.input.value, label: 'Field to replace or add' },
								value: { type: 'password', label: 'New protected value' }
							},
							(v) =>
								rpc('rotate', {
									id: entry.id,
									expected_version: metadata.version,
									material: { [v.field]: v.value }
								}),
							{ protectedEntry: true }
						);
					})
				)
			);
			controls.append(
				button('Access policy', () =>
					protect(async () => {
						const metadata = await request('vault', 'metadata', { id: entry.id });
						if (life.dead) return;
						form(
							'Manage credential access',
							{
								executors: {
									label: 'Allowed executor IDs (comma-separated)',
									value: metadata.allowed_executors.join(', ')
								},
								state: {
									label: 'Agent execution',
									options: [
										['enabled', 'Enabled'],
										['disabled', 'Disabled']
									],
									value: metadata.execution_disabled ? 'disabled' : 'enabled'
								}
							},
							async (v) => {
								const grant = await rpc('grant', {
									id: entry.id,
									expected_version: metadata.version,
									executors: v.executors
										.split(',')
										.map((s) => s.trim())
										.filter(Boolean)
								});
								if ((v.state === 'disabled') !== metadata.execution_disabled)
									await rpc(v.state === 'disabled' ? 'revoke' : 'restore', {
										id: entry.id,
										expected_version: grant.version
									});
							}
						);
					})
				)
			);
			section.append(controls, value);
			body.append(section);
		}
		if (!entries.length) paragraph(body, 'No credentials in this group.');
	}
	async function integrations() {
		const valid = life.ticket(),
			data = await request('integrations', 'list');
		if (!valid()) return;
		body.replaceChildren();
		if (consentUrl)
			body.append(
				el('a', 'Open HighLevel consent', {
					href: consentUrl,
					target: '_blank',
					rel: 'noopener noreferrer'
				})
			);
		body.append(
			button(
				'Add connection',
				() =>
					form(
						'Add connection',
						{
							id: {},
							provider: { options: ['highlevel', 'cloudflare', 'schwab'] },
							purpose: {},
							vault_handle: { label: 'Vault entry path' },
							account_id: { label: 'Provider account ID' },
							actors: {
								label: 'Authorized agents/services (comma-separated)',
								value: 'service:falcon-integrations'
							}
						},
						(v) =>
							host.request('falcon.integrations.manage', {
								action: 'create',
								input: {
									...v,
									actors: v.actors
										.split(',')
										.map((s) => s.trim())
										.filter(Boolean)
								}
							})
					),
				'primary'
			)
		);
		for (const connection of data.connections) {
			const section = el('section', null, { class: 'list-zone' });
			section.append(el('h2', connection.purpose ?? connection.id));
			paragraph(
				section,
				`${human(connection.provider)} · ${human(connection.health)} · ${human(connection.freshness ?? 'validation unavailable')}`
			);
			detailText(section, 'Connection', connection);
			const actions = el('div', null, { class: 'toolbar' });
			for (const [action, label] of [
				['test', 'Test connection'],
				['refresh', 'Refresh now'],
				['pause', 'Pause maintenance'],
				['resume', 'Resume maintenance'],
				['disconnect', 'Disconnect']
			])
				actions.append(
					button(label, () =>
						action === 'disconnect'
							? confirm('Disconnect this connection', () =>
									request('integrations', action, { id: connection.id }, true)
								)
							: protect(async () => {
									await request('integrations', action, { id: connection.id }, true);
									await refresh();
								})
					)
				);

			if (connection.provider === 'highlevel')
				actions.append(
					button('Authorize HighLevel', () =>
						form(
							'Begin HighLevel consent',
							{
								redirect_uri: { label: 'Approved callback URI' },
								scopes: { label: 'Scopes (space-separated)', value: 'locations.readonly' }
							},
							async (v) => {
								const result = await host.request('falcon.integrations.manage', {
									action: 'consent',
									input: {
										connection_id: connection.id,
										redirect_uri: v.redirect_uri,
										scopes: v.scopes.split(/\s+/).filter(Boolean)
									}
								});
								const url = new URL(result.authorization_url);
								if (url.origin !== 'https://marketplace.gohighlevel.com')
									throw Error('Unexpected consent destination');
								consentUrl = url.href;
								const link = el('a', 'Open HighLevel consent', {
									href: url.href,
									target: '_blank',
									rel: 'noopener noreferrer'
								});
								section.append(link);
								status.textContent =
									'Consent link ready. Sign-in is not proof of successful validation.';
							}
						)
					),
					button('Finish HighLevel consent', () =>
						form(
							'Finish HighLevel consent',
							{
								state: { type: 'password', label: 'Returned OAuth state' },
								code: { type: 'password', label: 'Authorization code' }
							},
							(v) => host.request('falcon.integrations.manage', { action: 'complete', input: v }),
							{ protectedEntry: true }
						)
					)
				);
			section.append(actions);
			body.append(section);
		}
		if (!data.connections.length)
			paragraph(
				body,
				'No connections configured. Live provider authorization requires consent; fixture proof is not a live connection.'
			);
		status.textContent = 'Connection health from the server';
	}
	async function documents() {
		const valid = life.ticket();
		if (!rootId) {
			const data = await request('documents', 'roots');
			if (!valid()) return;
			body.replaceChildren();
			for (const item of data.roots ?? data) {
				body.append(
					button(item.id, () =>
						protect(async () => {
							selectedFiles.clear();
							rootId = item.id;
							directory = '';
							await refresh();
						})
					)
				);
			}
			status.textContent = 'Choose a workspace';
			return;
		}
		const input = { root_id: rootId, path: directory, search: documentSearch, sort: documentSort };
		if (file) {
			const data =
				docDraft ?? (await request('documents', 'read', { root_id: rootId, path: file }));
			if (!valid()) return;
			body.replaceChildren(
				button('Back to folder', () =>
					protect(async () => {
						if (docDraft)
							return confirm('Discard unsaved changes', async () => {
								docDraft = null;
								file = null;
							});
						file = null;
						await refresh();
					})
				),
				el('h2', file)
			);
			const edit = field('Document content', { multiline: true, value: data.content });
			edit.input.classList.add('document-editor');
			edit.input.oninput = () => {
				docDraft = { content: edit.input.value, version: data.version };
			};
			body.append(edit.wrap);
			const preview = el('iframe', null, {
				title: 'Sandboxed Markdown preview',
				sandbox: '',
				class: 'document-preview'
			});
			const renderPreview = () => {
				preview.srcdoc = documentPreview(edit.input.value);
			};
			body.append(
				button('Preview Markdown', () => {
					renderPreview();
					preview.hidden = !preview.hidden;
				}),
				preview
			);
			preview.hidden = true;
			const actions = el('div', null, { class: 'toolbar' });
			actions.append(
				button('Compare latest version', () =>
					protect(async () => {
						const current = await request('documents', 'read', { root_id: rootId, path: file });
						if (life.dead) return;
						detailText(body, 'Latest saved content', current.content);
						body.append(
							button('Use latest version for next save', () => {
								data.version = current.version;
								if (docDraft) docDraft.version = current.version;
								status.textContent =
									'Your edits remain. The next Save will replace the reviewed latest version.';
							})
						);
					})
				)
			);
			actions.append(
				button(
					'Save',
					() =>
						protect(async () => {
							await request(
								'documents',
								'write',
								{
									root_id: rootId,
									path: file,
									content: edit.input.value,
									expected_version: data.version
								},
								true
							);
							docDraft = null;
							await refresh();
						}),
					'primary'
				),
				button('Download', () => {
					const url = URL.createObjectURL(new Blob([edit.input.value], { type: 'text/plain' })),
						a = el('a', null, { href: url, download: file.split('/').pop() });
					a.click();
					setTimeout(() => URL.revokeObjectURL(url), 1000);
				}),
				button('Copy path', () =>
					protect(async () => {
						const result = await request('documents', 'copy_path', { root_id: rootId, path: file });
						await navigator.clipboard.writeText(result.path);
					})
				),
				button('Rename', () =>
					form('Rename file', { destination: { value: file } }, (v) =>
						request(
							'documents',
							'rename',
							{
								root_id: rootId,
								path: file,
								destination: v.destination,
								expected_version: data.version
							},
							true
						).then(() => {
							file = v.destination;
							// Rename moves the saved file; preserve unsaved content and its reviewed version.
						})
					)
				),
				button('Move to trash', () =>
					confirm(`Move ${file} to trash`, async () => {
						const result = await request(
							'documents',
							'trash',
							{ root_id: rootId, path: file, expected_version: data.version, confirmed: true },
							true
						);
						lastTrash.push({ root_id: rootId, trash_id: result.trash_id, name: file });
						file = null;
						docDraft = null;
						status.textContent = 'Moved to trash; Undo is available in the folder.';
					})
				)
			);
			body.append(actions);
			status.textContent = docDraft
				? 'Unsaved changes'
				: 'Text view · document contents cannot execute scripts';
			return;
		}
		const data = await request('documents', 'list', input);
		if (!valid()) return;
		body.replaceChildren();
		const breadcrumbs = el('nav', null, { 'aria-label': 'Breadcrumbs' });
		breadcrumbs.append(
			button('Workspaces', () =>
				protect(async () => {
					selectedFiles.clear();
					rootId = '';
					await refresh();
				})
			),
			button(`${rootId} / ${directory || 'Root'}`, () =>
				protect(async () => {
					selectedFiles.clear();
					directory = directory.split('/').slice(0, -1).join('/');
					await refresh();
				})
			)
		);
		body.append(breadcrumbs);
		const actions = el('div', null, { class: 'toolbar' });
		actions.append(
			button('New file', () =>
				form('New file', { name: {}, content: { multiline: true } }, (v) =>
					request(
						'documents',
						'write',
						{
							root_id: rootId,
							path: [directory, v.name].filter(Boolean).join('/'),
							content: v.content,
							expected_version: null
						},
						true
					)
				)
			),
			button('New folder', () =>
				form('New folder', { name: {} }, (v) =>
					request(
						'documents',
						'mkdir',
						{ root_id: rootId, path: [directory, v.name].filter(Boolean).join('/') },
						true
					)
				)
			)
		);

		const search = field('Search filenames', { value: documentSearch }),
			sort = field('Sort', {
				value: documentSort,
				options: [
					['name', 'Name A–Z'],
					['name_desc', 'Name Z–A']
				]
			});
		search.input.onchange = () =>
			protect(async () => {
				documentSearch = search.input.value;
				await refresh();
			});
		sort.input.onchange = () =>
			protect(async () => {
				documentSort = sort.input.value;
				await refresh();
			});
		actions.append(search.wrap, sort.wrap);
		actions.append(
			button('Trash selected files', () => {
				const targets = [...selectedFiles],
					chosenRoot = rootId;
				if (!targets.length) {
					status.textContent = 'Select files first.';
					return;
				}
				confirm(`Move these files to trash: ${targets.join(', ')}`, async () => {
					const outcomes = [];
					for (const name of targets) {
						try {
							context.signal.throwIfAborted();
							const current = await request('documents', 'read', {
								root_id: chosenRoot,
								path: name
							});
							const result = await request(
								'documents',
								'trash',
								{
									root_id: chosenRoot,
									path: name,
									expected_version: current.version,
									confirmed: true
								},
								true
							);
							lastTrash.push({ root_id: chosenRoot, trash_id: result.trash_id, name });
							selectedFiles.delete(name);
							outcomes.push({ name, moved: true });
						} catch {
							outcomes.push({ name, moved: false });
						}
					}
					documentNotice = outcomes.every((r) => r.moved)
						? 'Selected files moved to trash.'
						: 'Some selected files were not moved; the remaining selection is preserved.';
				});
			})
		);
		for (const saved of lastTrash)
			actions.append(
				button(`Undo trash: ${saved.name}`, () =>
					protect(async () => {
						await request(
							'documents',
							'restore',
							{ root_id: saved.root_id, trash_id: saved.trash_id },
							true
						);
						lastTrash.splice(lastTrash.indexOf(saved), 1);
						await refresh();
					})
				)
			);
		const upload = field('Upload text file', { type: 'file' });
		upload.input.onchange = () =>
			protect(async () => {
				const source = upload.input.files?.[0];
				if (!source) return;
				if (source.size > 262144) throw Error('too_large');
				await request(
					'documents',
					'upload',
					{
						root_id: rootId,
						path: [directory, source.name].filter(Boolean).join('/'),
						content: await source.text(),
						expected_version: null
					},
					true
				);
				await refresh();
			});
		actions.append(upload.wrap);
		body.append(actions);
		for (const entry of data.entries) {
			const next = [directory, entry.name].filter(Boolean).join('/'),
				line = el('div', null, { class: 'file-row' });
			if (entry.kind === 'file') {
				const select = el('input', null, {
					type: 'checkbox',
					'aria-label': `Select ${entry.name}`
				});
				select.checked = selectedFiles.has(next);
				select.onchange = () => {
					if (select.checked && selectedFiles.size < 20) selectedFiles.add(next);
					else {
						selectedFiles.delete(next);
						select.checked = false;
					}
				};
				line.append(select);
			}
			line.append(
				row(entry, async () => {
					if (entry.kind === 'directory') {
						directory = next;
						selectedFiles.clear();
					} else file = next;
					await refresh();
				})
			);
			body.append(line);
		}

		if (!data.entries.length) paragraph(body, 'This folder is empty.');
		status.textContent = documentNotice || 'Authorized workspace';
	}
	refresh = () => ({ work, integrations, vault, documents })[module]();
	toolbar.append(button('Refresh', () => protect(refresh)));
	if (module === 'work') {
		for (const [id, label] of [
			['attention', 'Needs attention'],
			['projects', 'Projects'],
			['browse', 'Browse']
		])
			toolbar.append(
				button(label, () =>
					protect(async () => {
						scope = id;
						workOffset = 0;
						selected = null;
						await refresh();
					})
				)
			);
		toolbar.append(button('Create work', createWork, 'primary'));
		const search = field('Search work');
		search.input.onchange = () =>
			protect(async () => {
				query = search.input.value;
				workOffset = 0;
				scope = 'browse';
				selected = null;
				await refresh();
			});
		toolbar.append(search.wrap);
		const agent = field('Agent', {
				options: [
					['', 'All agents'],
					...(host.agents?.rows ?? []).map((a) => [a.id, a.name ?? a.id])
				]
			}),
			type = field('Work type', {
				options: [
					['', 'All types'],
					...['task', 'project', 'area', 'question', 'finding', 'decision', 'milestone'].map(
						(t) => [t, human(t)]
					)
				]
			});
		agent.input.onchange = () =>
			protect(async () => {
				agentFilter = agent.input.value;
				selected = null;
				workOffset = 0;
				await refresh();
			});
		type.input.onchange = () =>
			protect(async () => {
				browseType = type.input.value;
				scope = 'browse';
				selected = null;
				workOffset = 0;
				await refresh();
			});
		toolbar.append(agent.wrap, type.wrap);
	}
	let wasConnected = host.connection.connected;
	const unsubscribe = host.subscribe(() => {
		const connected = host.connection.connected;
		if (!connected || !host.connection.canWrite) {
			life.clear();
			clearSecrets();
			status.textContent = connected ? 'Read-only access' : 'Disconnected — drafts preserved';
		}
		if (connected && !wasConnected) {
			if (busy) refreshAfterReconnect = true;
			else protect(refresh);
		}
		wasConnected = connected;
	});
	const events =
		module === 'work'
			? host.onEvent('falcon_work_changed', () => {
					status.textContent = 'Work changed. Refresh to review the latest version.';
				})
			: () => {};
	if (module === 'vault') {
		refreshTimer = setInterval(async () => {
			if (life.dead || !host.connection.connected) return;
			try {
				const state = await request('vault', 'status');
				if (
					state.locked ||
					state.can_manage === false ||
					(vaultEpoch !== undefined && state.epoch !== vaultEpoch)
				) {
					life.clear();
					clearSecrets();
					if (status.textContent !== 'Vault locked') protect(refresh);
				}
			} catch {
				clearSecrets();
			}
		}, 1000);
	}
	protect(async () => {
		const available = await host.request('falcon.ui.status', {});
		if (!available.modules.includes(module)) {
			status.textContent = 'This module is disabled in the plugin configuration.';
			return;
		}
		await refresh();
	});
	return {
		dispose() {
			closeDialog();
			life.dispose();
			unsubscribe();
			events();
			clearInterval(refreshTimer);
			root.remove();
		},
		update(next) {
			if (!next.presented) life.clear();
		},
		focus() {
			heading.tabIndex = -1;
			heading.focus();
		}
	};
}
export default defineControlUiPlugin({
	id: 'falcon-dash',
	activate(host) {
		const disposers = [];
		for (const [id, label] of Object.entries(names)) {
			disposers.push(
				host.ui.registerPage({
					id,
					label,
					mount: (container, context) => mount(container, context, id)
				})
			);
			disposers.push(
				host.ui.registerNavigation({ id, label, page: { id }, order: 40 + disposers.length })
			);
		}
		return () => disposers.reverse().forEach((dispose) => dispose());
	}
});
