<script lang="ts">
	import CanvasBlock from './canvas/CanvasBlock.svelte';
	import ExecApprovalPrompt from './ExecApprovalPrompt.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { canvasStore } from '$lib/stores/canvas.js';
	import { pendingApprovals, resolveApproval, addToDenylist } from '$lib/stores/exec-approvals.js';
	import type { CanvasSurface } from '$lib/stores/canvas.js';
	import type { PendingApproval } from '$lib/stores/exec-approvals.js';
	import {
		Bell,
		ClipboardList,
		FlaskConical,
		LockKeyhole,
		MessageSquareText,
		Search,
		Settings,
		ShieldCheck,
		TerminalSquare
	} from '@lucide/svelte';

	let { children }: { children: import('svelte').Snippet } = $props();
	let currentSurface = $state<CanvasSurface | null>(null);
	let canvasPanelMinimized = $state(false);
	let approvals = $state<PendingApproval[]>([]);
	let shellSearch = $state('');

	$effect(() => {
		const unsub = pendingApprovals.subscribe((v) => {
			approvals = v;
		});
		return unsub;
	});

	function handleResolve(requestId: string, decision: 'allow-once' | 'allow-always' | 'deny') {
		resolveApproval(requestId, decision).catch(() => {});
	}

	function handleAlwaysDeny(requestId: string, command: string) {
		addToDenylist(command);
		resolveApproval(requestId, 'deny').catch(() => {});
	}

	// Track current canvas surface at the shell level
	$effect(() => {
		const unsub = canvasStore.currentSurface.subscribe((v) => {
			currentSurface = v;
		});
		return unsub;
	});

	const modules = [
		{ label: 'Work', href: '/work', icon: ClipboardList, title: 'Work' },
		{ label: 'Vault', href: '/passwords', icon: LockKeyhole, title: 'Vault Operations' },
		{ label: 'Channels', href: '/channels', icon: MessageSquareText, title: 'Channels Hub' },
		{ label: 'Labs', href: '/settings', icon: FlaskConical, title: 'Labs / Advanced' }
	] as const;

	const path = $derived(page.url.pathname);
	const activeModule = $derived.by(() => {
		if (path === '/secrets') return modules[1];
		if (
			path.startsWith('/approvals') ||
			path.startsWith('/documents') ||
			path.startsWith('/jobs') ||
			path.startsWith('/ops') ||
			path.startsWith('/skills') ||
			path.startsWith('/settings') ||
			path.startsWith('/apps') ||
			path.startsWith('/agents') ||
			path.startsWith('/heartbeat')
		) {
			return modules[3];
		}
		return modules.find((item) => path.startsWith(item.href)) ?? modules[0];
	});

	const appVersion = `v${__APP_VERSION__}`;

	$effect(() => {
		if (activeModule.label !== 'Work') {
			shellSearch = '';
			return;
		}
		if (path === '/work/browse') shellSearch = page.url.searchParams.get('q') ?? '';
	});

	type ModuleHref = (typeof modules)[number]['href'] | '/work';

	function navigate(href: ModuleHref) {
		goto(resolve(href));
	}
</script>

<div class="falcon-product-shell bg-background text-on-surface">
	<nav
		class="fixed left-0 top-0 z-50 hidden h-screen w-16 flex-col items-center border-r border-outline-variant/70 bg-surface-container-lowest/95 py-4 shadow-[12px_0_40px_rgba(0,0,0,0.18)] md:flex"
		aria-label="Falcon Dash modules"
	>
		<button
			type="button"
			onclick={() => navigate('/work')}
			class="falcon-focus mb-8 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/35 bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/10 transition hover:bg-primary/90"
			aria-label="Work"
			title="Work"
		>
			<ShieldCheck class="h-5 w-5" />
		</button>

		<div class="flex flex-1 flex-col items-center gap-3">
			{#each modules as item (item.label)}
				{@const Icon = item.icon}
				<button
					type="button"
					onclick={() => navigate(item.href)}
					class="falcon-focus group relative flex h-12 w-12 items-center justify-center rounded-lg border transition {activeModule.label ===
					item.label
						? 'border-primary/40 bg-primary-container text-primary'
						: 'border-transparent text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-high hover:text-primary'}"
					aria-label={item.label}
					title={item.label}
				>
					<Icon class="h-5 w-5" />
					<span
						class="pointer-events-none absolute left-14 z-50 rounded-md border border-outline-variant bg-surface-container-high px-2 py-1 text-xs font-semibold text-primary opacity-0 shadow-lg transition group-hover:opacity-100"
					>
						{item.label}
					</span>
				</button>
			{/each}
		</div>

		<div class="flex flex-col items-center gap-3">
			<button
				type="button"
				class="falcon-focus flex h-12 w-12 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary"
				aria-label="Notifications"
				title="Notifications"
			>
				<Bell class="h-5 w-5" />
			</button>
			<button
				type="button"
				onclick={() => navigate('/settings')}
				class="falcon-focus flex h-12 w-12 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary"
				aria-label="Settings"
				title="Settings"
			>
				<Settings class="h-5 w-5" />
			</button>
		</div>
	</nav>

	<header
		class="fixed left-0 right-0 top-0 z-40 flex min-h-12 items-center justify-between gap-3 border-b border-outline-variant/70 bg-surface/95 px-3 shadow-[0_10px_40px_rgba(0,0,0,0.14)] backdrop-blur md:left-16 md:px-4"
	>
		<div class="flex min-w-0 flex-1 items-center gap-3">
			<div class="flex items-center gap-2 md:hidden">
				<ShieldCheck class="h-5 w-5 text-primary" />
				<span class="text-xs font-bold text-primary"> Falcon </span>
			</div>
			<div class="hidden items-center gap-3 md:flex">
				<TerminalSquare class="h-4 w-4 text-on-surface-variant" />
				<h1 class="truncate text-[18px] font-semibold leading-6 tracking-normal text-primary">
					{activeModule.title}
				</h1>
			</div>
			<div class="hidden h-5 w-px bg-outline-variant lg:block"></div>
			{#if activeModule.label === 'Work'}
				<form
					action={resolve('/work/browse')}
					method="GET"
					class="hidden min-w-0 items-center gap-2 rounded-md border border-outline-variant/70 bg-surface-container-low px-2 py-1 text-on-surface-variant md:flex"
					role="search"
					aria-label="Search Work"
				>
					<Search class="h-4 w-4" />
					<input
						type="search"
						name="q"
						bind:value={shellSearch}
						placeholder="Search work..."
						class="h-7 w-48 border-0 bg-transparent p-0 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-0 lg:w-72"
					/>
				</form>
			{/if}
		</div>

		<div class="flex shrink-0 items-center gap-3">
			<span class="font-mono text-xs font-semibold text-on-surface-variant">{appVersion}</span>
		</div>
	</header>

	<nav
		class="fixed bottom-0 left-0 right-0 z-50 grid h-16 grid-cols-4 border-t border-outline-variant/70 bg-surface-container-lowest/95 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] backdrop-blur md:hidden"
		aria-label="Falcon Dash mobile modules"
	>
		{#each modules as item (item.label)}
			{@const Icon = item.icon}
			<button
				type="button"
				onclick={() => navigate(item.href)}
				class="falcon-focus flex flex-col items-center justify-center gap-1 text-[10px] font-semibold {activeModule.label ===
				item.label
					? 'text-primary'
					: 'text-on-surface-variant'}"
			>
				<Icon class="h-4 w-4" />
				<span>{item.label}</span>
			</button>
		{/each}
	</nav>

	<main class="min-h-screen overflow-hidden pl-0 pt-12 md:pl-16">
		{#if approvals.length > 0}
			<div class="border-b border-outline-variant/70 bg-surface-container-low p-3">
				<ExecApprovalPrompt
					approval={approvals[0]}
					pendingCount={approvals.length}
					onResolve={handleResolve}
					onAlwaysDeny={handleAlwaysDeny}
				/>
			</div>
		{/if}

		<div class="h-[calc(100vh-3rem)] overflow-y-auto pb-20 md:pb-0">
			{@render children()}
		</div>

		<!-- Floating canvas panel: visible on ALL pages when a surface is active -->
		{#if currentSurface && currentSurface.visible}
			<div class="canvas-float-panel border-t border-outline-variant/70">
				<div class="flex items-center justify-between px-3 py-1.5">
					<span class="text-xs font-medium text-on-surface-variant">
						Canvas: {currentSurface.title}
					</span>
					<button
						onclick={() => (canvasPanelMinimized = !canvasPanelMinimized)}
						class="text-xs text-on-surface-variant hover:text-primary"
						aria-label={canvasPanelMinimized ? 'Expand canvas' : 'Minimize canvas'}
					>
						{canvasPanelMinimized ? 'Expand' : 'Minimize'}
					</button>
				</div>
				{#if !canvasPanelMinimized}
					<div class="px-4 pb-3">
						<CanvasBlock surfaceId={currentSurface.surfaceId} />
					</div>
				{/if}
			</div>
		{/if}
	</main>
</div>
