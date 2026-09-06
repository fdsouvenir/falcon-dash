import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Window } from 'happy-dom';
import { ViewLifetime } from '../native/lifetime.mjs';
const bundle = await build({
	entryPoints: ['plugin/native/control-ui.mjs'],
	bundle: true,
	write: false,
	format: 'iife',
	globalName: 'FalconTest',
	platform: 'browser',
	loader: { '.css': 'empty' }
});
const settle = () => new Promise((r) => setTimeout(r, 25));
async function fixture(t, module, handler) {
	const window = new Window({ url: 'https://fixture.invalid' });
	const native = window.eval(bundle.outputFiles[0].text + ';FalconTest;');
	const pages = new Map(),
		navigation = [],
		controller = new AbortController(),
		listeners = new Set(),
		calls = [];
	const host = {
		pluginId: 'falcon-dash',
		signal: controller.signal,
		connection: { connected: true, canRead: true, canWrite: true },
		async request(method, p) {
			calls.push({ method, p });
			if (method === 'falcon.ui.status')
				return { modules: ['work', 'vault', 'integrations', 'documents'] };
			return handler(method, p);
		},
		subscribe(fn) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		onEvent() {
			return () => {};
		},
		components: {
			mountDialog(_container, props) {
				const dialog = window.document.createElement('section');
				dialog.setAttribute('role', 'dialog');
				dialog.setAttribute('aria-label', props.label);
				dialog.append(props.content);
				window.document.body.append(dialog);
				return {
					dispose() {
						dialog.remove();
					}
				};
			}
		},
		ui: {
			registerPage(p) {
				pages.set(p.id, p);
				return () => pages.delete(p.id);
			},
			registerNavigation(n) {
				navigation.push(n);
				return () => {};
			}
		}
	};
	const deactivate = native.default.activate(host),
		container = window.document.createElement('div');
	window.document.body.append(container);
	const view = pages
		.get(module)
		.mount(container, { host, signal: controller.signal, presented: true });
	t.after(() => {
		view.dispose();
		deactivate();
		controller.abort();
		window.happyDOM.abort();
	});
	await settle();
	return {
		window,
		host,
		calls,
		navigation,
		view,
		controller,
		notify: () => listeners.forEach((fn) => fn()),
		text: () => window.document.body.textContent,
		button(label) {
			const b = [...window.document.querySelectorAll('button')].find(
				(n) => n.textContent === label
			);
			assert.ok(b, `Missing button ${label}`);
			b.click();
			return b;
		}
	};
}
test('Native plugin registers four pages and uses the typed feature query transport', async (t) => {
	const f = await fixture(t, 'work', async (method, p) => {
		assert.equal(method, 'plugins.sessionAction');
		assert.equal(p.actionId, 'work_queue');
		return {
			ok: true,
			result: {
				buckets: {
					ready: {
						items: [
							{
								id: 'task-one',
								type: 'task',
								title: 'Prepare the migration review',
								status: 'ready'
							}
						]
					}
				}
			}
		};
	});
	assert.equal(f.navigation.length, 4);
	assert.match(f.text(), /Prepare the migration review/);
	assert.ok(!f.text().includes('read-only preview'));
});
test('Native work ignores late asynchronous results after disposal', async (t) => {
	let release;
	const f = await fixture(t, 'work', () => new Promise((r) => (release = r)));
	f.view.dispose();
	release({
		ok: true,
		result: { buckets: { ready: { items: [{ id: 'late', title: 'Late result' }] } } }
	});
	await settle();
	assert.ok(!f.text().includes('Late result'));
});
test('Protected native input is not persisted and clears outside the mount container on disconnect', async (t) => {
	const f = await fixture(t, 'vault', async (method, p) => {
		if (p.action === 'status') return { locked: false, epoch: 1, can_manage: true };
		if (p.action === 'inventory') return { entries: [] };
		throw Error('unexpected');
	});
	f.button('Add credential');
	const input = f.window.document.querySelector('input[type=password]');
	assert.ok(input);
	input.value = 'SYNTHETIC-SECRET';
	f.host.connection.connected = false;
	f.notify();
	assert.equal(input.value, '');
	assert.equal(f.window.localStorage.length, 0);
	assert.ok(!JSON.stringify(f.calls).includes('SYNTHETIC-SECRET'));
});
test('Reveal is deliberate and Hide and navigation cleanup remove the selected value', async (t) => {
	const f = await fixture(t, 'vault', async (method, p) => {
		if (p.action === 'status') return { locked: false, epoch: 1, can_manage: true };
		if (p.action === 'inventory') return { entries: [{ id: 'agent-created', kind: 'entry' }] };
		if (p.action === 'reveal') return { value: 'SYNTHETIC-REVEALED' };
		throw Error('unexpected');
	});
	assert.ok(!f.text().includes('SYNTHETIC-REVEALED'));
	f.button('Reveal');
	await settle();
	assert.match(f.text(), /SYNTHETIC-REVEALED/);
	f.button('Hide');
	assert.ok(!f.text().includes('SYNTHETIC-REVEALED'));
	f.button('Reveal');
	await settle();
	f.view.update({ presented: false });
	assert.ok(!f.text().includes('SYNTHETIC-REVEALED'));
});
test('A pending reveal cannot repopulate after authority loss', async (t) => {
	let release;
	const f = await fixture(t, 'vault', async (method, p) => {
		if (p.action === 'status') return { locked: false, epoch: 1, can_manage: true };
		if (p.action === 'inventory') return { entries: [{ id: 'one', kind: 'entry' }] };
		if (p.action === 'reveal') return new Promise((r) => (release = r));
	});
	f.button('Reveal');
	await settle();
	f.host.connection.canWrite = false;
	f.notify();
	release({ value: 'SYNTHETIC-LATE' });
	await settle();
	assert.ok(!f.text().includes('SYNTHETIC-LATE'));
});
test('Documents preserves text as untrusted non-executing content', async (t) => {
	const f = await fixture(t, 'documents', async (method, p) => {
		if (p.action === 'roots') return { roots: [{ id: 'workspace', writable: true }] };
		if (p.action === 'list') return { entries: [{ name: 'malicious.html', kind: 'file' }] };
		if (p.action === 'read')
			return {
				content: '<img src=x onerror="window.bad=1"><script>window.bad=2</script>',
				version: 'one'
			};
	});
	f.button('workspace');
	await settle();
	const row = f.window.document.querySelector('.record');
	row.click();
	await settle();
	assert.equal(f.window.bad, undefined);
	assert.equal(f.window.document.querySelectorAll('img,script').length, 0);
	assert.match(f.window.document.querySelector('textarea').value, /onerror/);
});
test('A lifetime invalidates earlier requests and invokes cleanup on abort', () => {
	const c = new AbortController(),
		life = new ViewLifetime(c.signal);
	let cleared = 0;
	life.own(() => cleared++);
	const first = life.ticket(),
		second = life.ticket();
	assert.equal(first(), false);
	assert.equal(second(), true);
	c.abort();
	assert.equal(second(), false);
	assert.equal(cleared, 1);
});
test('Native schema form creates a real Task through the shared command contract', async (t) => {
	const fs = await import('node:fs'),
		os = await import('node:os'),
		path = await import('node:path'),
		{ WorkStore } = await import('../work/store.mjs');
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'falcon-ui-command-')),
		store = new WorkStore(path.join(dir, 'work.db'));
	t.after(() => {
		store.close();
		fs.rmSync(dir, { recursive: true });
	});
	const f = await fixture(t, 'work', async (method, p) => {
		if (method === 'falcon.identity') return { bound: true };
		if (method === 'plugins.sessionAction') {
			if (p.actionId === 'work_queue') return { ok: true, result: store.queue({}) };
			if (p.actionId === 'work_command')
				return { ok: true, result: store.execute(p.payload, 'human:owner') };
		}
		throw Error('Unexpected operation');
	});
	f.button('Create work');
	f.button('Save');
	await settle();
	const labels = [...f.window.document.querySelectorAll('label')];
	for (const [label, value] of [
		['Title *', 'Review native UI'],
		['Description *', 'Exercise canonical command validation'],
		['Done When *', 'A created Task appears in the store']
	]) {
		const node = labels.find((n) => n.querySelector('span')?.textContent === label);
		assert.ok(node, label);
		node.querySelector('input,textarea').value = value;
	}
	f.button('Save');
	await settle();
	assert.equal(store.list({}).items[0].title, 'Review native UI');
	assert.equal(f.window.document.querySelectorAll('[role=dialog]').length, 0);
});
test('Markdown preview excludes executable HTML and embeds a deny-by-default CSP', async () => {
	const { documentPreview } = await import('../native/markdown.mjs');
	const html = documentPreview(
		'# Safe heading\n<script>alert(1)</script>\n[bad](javascript:alert(1))\n<img src=x onerror=alert(1)>'
	);
	assert.match(html, /<h1>Safe heading<\/h1>/);
	assert.ok(!html.includes('<script>'));
	assert.ok(!html.includes('onerror'));
	assert.ok(!html.includes('href="javascript:'));
	assert.match(html, /default-src 'none'/);
});
test('Copy is explicit and a revoked in-flight copy cannot write the clipboard', async (t) => {
	let release,
		writes = 0;
	const f = await fixture(t, 'vault', async (_method, p) => {
		if (p.action === 'status') return { locked: false, epoch: 1, can_manage: true };
		if (p.action === 'inventory') return { entries: [{ id: 'agent-created', kind: 'entry' }] };
		if (p.action === 'copy') return new Promise((r) => (release = r));
	});
	Object.defineProperty(f.window.navigator, 'clipboard', {
		value: {
			async writeText() {
				writes++;
			}
		}
	});
	assert.equal(writes, 0);
	f.button('Copy');
	await settle();
	f.host.connection.connected = false;
	f.notify();
	release({ value: 'SYNTHETIC-COPY' });
	await settle();
	assert.equal(writes, 0);
});
test('An external Vault lock clears the native selected value on the next status observation', async (t) => {
	let locked = false;
	const f = await fixture(t, 'vault', async (_method, p) => {
		if (p.action === 'status') return { locked, epoch: locked ? 2 : 1, can_manage: true };
		if (p.action === 'inventory') return { entries: [{ id: 'one', kind: 'entry' }] };
		if (p.action === 'reveal') return { value: 'SYNTHETIC-LIVE-LOCK' };
	});
	f.button('Reveal');
	await settle();
	assert.match(f.text(), /SYNTHETIC-LIVE-LOCK/);
	locked = true;
	await new Promise((r) => setTimeout(r, 1100));
	assert.ok(!f.text().includes('SYNTHETIC-LIVE-LOCK'));
	assert.match(f.text(), /Vault locked/);
});
test('Reconnect schedules a fresh query after an earlier in-flight query retires', async (t) => {
	let calls = 0,
		release;
	const f = await fixture(t, 'work', async () => {
		calls++;
		if (calls === 1) return new Promise((r) => (release = r));
		return {
			ok: true,
			result: { buckets: { ready: { items: [{ id: 'new', title: 'Reconnected result' }] } } }
		};
	});
	f.host.connection.connected = false;
	f.notify();
	f.host.connection.connected = true;
	f.notify();
	release({
		ok: true,
		result: { buckets: { ready: { items: [{ id: 'old', title: 'Stale result' }] } } }
	});
	await settle();
	await settle();
	assert.equal(calls, 2);
	assert.match(f.text(), /Reconnected result/);
	assert.ok(!f.text().includes('Stale result'));
});
test('Disconnect clears protected values without discarding an ordinary open form', async (t) => {
	const f = await fixture(t, 'work', async () => ({ ok: true, result: { buckets: {} } }));
	f.button('Create work');
	const dialog = f.window.document.querySelector('[role=dialog]');
	assert.ok(dialog);
	f.host.connection.connected = false;
	f.notify();
	assert.equal(f.window.document.querySelector('[role=dialog]'), dialog);
});
test('Retrying a native create after a lost reply reuses its actor-bound receipt', async (t) => {
	const fs = await import('node:fs'),
		os = await import('node:os'),
		path = await import('node:path'),
		{ WorkStore } = await import('../work/store.mjs');
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'falcon-ui-retry-')),
		store = new WorkStore(path.join(dir, 'work.db'));
	t.after(() => {
		store.close();
		fs.rmSync(dir, { recursive: true });
	});
	let lost = true;
	const keys = [];
	const f = await fixture(t, 'work', async (method, p) => {
		if (method === 'falcon.identity') return { bound: true };
		if (p.actionId === 'work_queue') return { ok: true, result: store.queue({}) };
		if (p.actionId === 'work_command') {
			keys.push(p.payload.idempotency_key);
			const result = store.execute(p.payload, 'human:owner');
			if (lost) {
				lost = false;
				throw Error('Reply lost after commit');
			}
			return { ok: true, result };
		}
		throw Error('Unexpected call');
	});
	f.button('Create work');
	f.button('Save');
	await settle();
	for (const [label, value] of [
		['Title *', 'Only one record'],
		['Description *', 'Preserve intent across an uncertain reply'],
		['Done When *', 'One actor-bound receipt exists']
	]) {
		const wrap = [...f.window.document.querySelectorAll('label')].find(
			(n) => n.querySelector('span')?.textContent === label
		);
		wrap.querySelector('input,textarea').value = value;
	}
	f.button('Save');
	await settle();
	assert.equal(store.list({}).items.length, 1);
	assert.equal(f.window.document.querySelectorAll('[role=dialog]').length, 1);
	f.button('Save');
	await settle();
	assert.equal(store.list({}).items.length, 1);
	assert.equal(keys[0], keys[1]);
	assert.equal(f.window.document.querySelectorAll('[role=dialog]').length, 0);
});
for (const action of ['reveal', 'copy'])
	test(`Hide retires a pending ${action} response`, async (t) => {
		let release;
		const f = await fixture(t, 'vault', async (method, p) => {
			if (p.action === 'status') return { locked: false, epoch: 1, can_manage: true };
			if (p.action === 'inventory') return { entries: [{ id: 'one', kind: 'entry' }] };
			if (p.action === action) return new Promise((r) => (release = r));
		});
		f.button(action === 'reveal' ? 'Reveal' : 'Copy');
		await settle();
		f.button('Hide');
		release({ value: 'SYNTHETIC-LATE-HIDDEN' });
		await settle();
		assert.ok(!f.text().includes('SYNTHETIC-LATE-HIDDEN'));
		assert.notEqual(await f.window.navigator.clipboard.readText(), 'SYNTHETIC-LATE-HIDDEN');
	});
for (const conflict of [false, true])
	test(`Dirty document rename preserves edit buffer (preceding conflict: ${conflict})`, async (t) => {
		let version = 'one';
		const f = await fixture(t, 'documents', async (method, p) => {
			if (p.action === 'roots') return { roots: [{ id: 'workspace', writable: true }] };
			if (p.action === 'list') return { entries: [{ name: 'note.md', kind: 'file' }] };
			if (p.action === 'read') return { content: 'Saved content', version };
			if (p.action === 'write') throw Error('version_conflict');
			if (p.action === 'rename') {
				assert.equal(p.expected_version, version);
				return { path: p.destination, version };
			}
		});
		f.button('workspace');
		await settle();
		f.window.document.querySelector('.record').click();
		await settle();
		const editor = f.window.document.querySelector('textarea');
		editor.value = 'Unsaved important edit';
		editor.dispatchEvent(new f.window.Event('input'));
		if (conflict) {
			version = 'two';
			f.button('Save');
			await settle();
			f.button('Compare latest version');
			await settle();
			f.button('Use latest version for next save');
		}
		f.button('Rename');
		const dialog = f.window.document.querySelector('[role=dialog]');
		dialog.querySelector('input').value = 'renamed.md';
		dialog.querySelector('button[type=submit]').click();
		await settle();
		assert.equal(f.window.document.querySelector('textarea').value, 'Unsaved important edit');
		assert.match(f.text(), /renamed.md/);
	});
test('Native select controls expose stable names independent of their option text', async (t) => {
	const f = await fixture(t, 'work', async () => ({ ok: true, result: { buckets: {} } }));
	const type = f.window.document.querySelector('select[aria-label="Work type"]');
	assert.ok(type);
	assert.equal(type.value, '');
	assert.ok(type.textContent.includes('Decision'));
});

test('Integrations keeps formatted operator status primary and record internals collapsed', async (t) => {
	const f = await fixture(t, 'integrations', async () => ({
		connections: [
			{
				id: 'fixture-connection',
				provider: 'cloudflare',
				purpose: 'Review connection',
				owner: 'falcon',
				phase: 'idle',
				version: 4,
				paused: true,
				health: 'unavailable',
				freshness: 'stale',
				next_at: 1788714483520,
				last_success: null,
				last_failure: 'invalid',
				validated_capabilities: []
			}
		]
	}));
	const section = f.window.document.querySelector('.list-zone');
	const details = [...section.querySelectorAll('details')].find(
		(n) => n.querySelector('summary')?.textContent === 'Technical details'
	);
	assert.ok(details);
	assert.equal(details.open, false);
	assert.match(details.textContent, /Owner/);
	assert.match(details.textContent, /Phase/);
	const primary = section.cloneNode(true);
	primary.querySelector('details').remove();
	assert.doesNotMatch(primary.textContent, /1788714483520|Owner|Version|Phase/);
	assert.match(primary.textContent, /Not recorded/);
	assert.match(primary.textContent, /Unknown \(invalid timestamp\)/);
	assert.match(primary.textContent, /Paused/);
	assert.match(primary.textContent, /2026/);
	assert.match(primary.textContent, /Stored due time; maintenance is paused/);
});

for (const [type, action] of [
	['project', 'resume'],
	['question', 'withdraw'],
	['decision', 'withdraw']
])
	test(`Native ${type} exposes existing ${action} semantic action`, async (t) => {
		const record = {
			id: 'review-item',
			type,
			title: 'Review item',
			status: type === 'project' ? 'abandoned' : 'pending',
			version: 1
		};
		const f = await fixture(t, 'work', async (method, p) => {
			if (method === 'plugins.sessionAction')
				return { ok: true, result: { buckets: { ready: { items: [record] } } } };
			if (p.action === 'get') return record;
			throw Error('Unexpected method');
		});
		f.window.document.querySelector('.record').click();
		await settle();
		const actionMenu = f.window.document.querySelector('select[aria-label="Action"]');
		assert.ok([...actionMenu.options].some((o) => o.value === action));
	});

test('Native Work recovers truncated saved content and traverses history pages', async (t) => {
	const record = {
		id: 'large',
		type: 'task',
		title: 'Large saved record',
		status: 'open',
		version: 1,
		truncation: {
			truncated: true,
			fields: [{ path: '$.description', original_size: 4000, returned_size: 2000 }]
		}
	};
	const f = await fixture(t, 'work', async (method, p) => {
		if (method === 'plugins.sessionAction')
			return { ok: true, result: { buckets: { ready: { items: [record] } } } };
		if (p.action === 'get')
			return p.full
				? { ...record, description: 'FULL CONTENT TAIL', artifacts: [], history: [] }
				: record;
		if (p.action === 'history')
			return {
				items: [{ summary: p.query.offset ? 'LAST HISTORY PAGE' : 'FIRST HISTORY PAGE' }],
				next_offset: p.query.offset ? null : 25
			};
	});
	f.window.document.querySelector('.record').click();
	await settle();
	f.button('Read full saved content');
	await settle();
	assert.match(f.text(), /FULL CONTENT TAIL/);
	f.button('Load history');
	await settle();
	assert.match(f.text(), /FIRST HISTORY PAGE/);
	f.button('Load more history');
	await settle();
	assert.match(f.text(), /LAST HISTORY PAGE/);
	assert.equal(f.calls.filter((x) => x.p?.action === 'history')[1].p.query.offset, 25);
});
