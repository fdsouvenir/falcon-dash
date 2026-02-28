<script lang="ts">
	import { onMount } from 'svelte';
	import { Terminal } from '@xterm/xterm';
	import { FitAddon } from '@xterm/addon-fit';
	import { WebLinksAddon } from '@xterm/addon-web-links';

	let terminalEl: HTMLDivElement;
	let terminal: Terminal | null = null;
	let fitAddon: FitAddon | null = null;
	let ws: WebSocket | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let status = $state<'connecting' | 'connected' | 'disconnected'>('disconnected');

	function getWsUrl(): string {
		const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		return `${proto}//${window.location.host}/terminal-ws`;
	}

	function connect() {
		if (ws && ws.readyState <= WebSocket.OPEN) return;

		status = 'connecting';
		ws = new WebSocket(getWsUrl());

		ws.onopen = () => {
			status = 'connected';
			// Send initial size
			if (fitAddon && terminal) {
				fitAddon.fit();
				const dims = fitAddon.proposeDimensions();
				if (dims) {
					ws!.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
				}
			}
		};

		ws.onmessage = (event) => {
			terminal?.write(typeof event.data === 'string' ? event.data : '');
		};

		ws.onclose = () => {
			status = 'disconnected';
			scheduleReconnect();
		};

		ws.onerror = () => {
			// onclose will fire after this
		};
	}

	function scheduleReconnect() {
		if (reconnectTimer) return;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			connect();
		}, 3000);
	}

	onMount(() => {
		terminal = new Terminal({
			cursorBlink: true,
			fontSize: 14,
			fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
			theme: {
				background: '#030712',
				foreground: '#e5e7eb',
				cursor: '#60a5fa',
				selectionBackground: '#374151',
				black: '#1f2937',
				red: '#ef4444',
				green: '#22c55e',
				yellow: '#eab308',
				blue: '#3b82f6',
				magenta: '#a855f7',
				cyan: '#06b6d4',
				white: '#e5e7eb',
				brightBlack: '#6b7280',
				brightRed: '#f87171',
				brightGreen: '#4ade80',
				brightYellow: '#facc15',
				brightBlue: '#60a5fa',
				brightMagenta: '#c084fc',
				brightCyan: '#22d3ee',
				brightWhite: '#f9fafb'
			}
		});

		fitAddon = new FitAddon();
		terminal.loadAddon(fitAddon);
		terminal.loadAddon(new WebLinksAddon());

		terminal.open(terminalEl);
		fitAddon.fit();

		// Forward keystrokes to PTY
		terminal.onData((data) => {
			if (ws && ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: 'input', data }));
			}
		});

		// Auto-resize on container size change
		resizeObserver = new ResizeObserver(() => {
			if (fitAddon) {
				fitAddon.fit();
				if (ws && ws.readyState === WebSocket.OPEN && terminal) {
					const dims = fitAddon.proposeDimensions();
					if (dims) {
						ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
					}
				}
			}
		});
		resizeObserver.observe(terminalEl);

		connect();

		return () => {
			if (reconnectTimer) clearTimeout(reconnectTimer);
			resizeObserver?.disconnect();
			ws?.close();
			terminal?.dispose();
		};
	});
</script>

<div class="flex h-full flex-col overflow-hidden bg-gray-950">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-gray-800 px-4 py-2">
		<span class="text-sm font-medium text-gray-300">Terminal</span>
		<div class="flex items-center gap-2">
			<span
				class="inline-block h-2 w-2 rounded-full {status === 'connected'
					? 'bg-green-500'
					: status === 'connecting'
						? 'bg-yellow-500'
						: 'bg-red-500'}"
			></span>
			<span class="text-xs text-gray-500">{status}</span>
		</div>
	</div>

	<!-- Terminal -->
	<div class="flex-1 overflow-hidden p-1" bind:this={terminalEl}></div>
</div>
