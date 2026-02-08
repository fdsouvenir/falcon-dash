<script lang="ts">
	import { gateway } from '$lib/gateway';
	import { ConnectionState } from '$lib/gateway/types';
	import { getGatewayUrl, getToken, setGatewayUrl, setToken } from '$lib/gateway/auth';
	import { connectionState, connId, gatewayUrl, serverVersion } from '$lib/stores';

	let url = getGatewayUrl();
	let token = getToken() || '';
	let error = '';
	let connecting = false;

	$: isConnected =
		$connectionState === ConnectionState.READY || $connectionState === ConnectionState.CONNECTED;

	async function handleConnect() {
		error = '';
		connecting = true;

		setGatewayUrl(url);
		setToken(token);

		try {
			const payload = await gateway.connect({ url, token });
			gatewayUrl.set(url);
			connId.set(payload.server.connId);
			serverVersion.set(payload.server.version);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Connection failed';
		} finally {
			connecting = false;
		}
	}

	function handleDisconnect() {
		gateway.disconnect();
		connId.set('');
		serverVersion.set('');
	}
</script>

{#if isConnected}
	<div class="p-8">
		<h1 class="text-2xl font-bold">Falcon Dash</h1>
		<p class="mt-2 text-slate-400">Connected to gateway</p>
		<div class="mt-4 space-y-1 text-sm text-slate-400">
			<p>URL: {$gatewayUrl}</p>
			<p>Connection ID: {$connId}</p>
			<p>Server Version: {$serverVersion}</p>
		</div>
		<button
			on:click={handleDisconnect}
			class="mt-6 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
		>
			Disconnect
		</button>
	</div>
{:else}
	<div class="flex min-h-full items-center justify-center p-8">
		<div class="w-full max-w-md space-y-6">
			<div>
				<h1 class="text-2xl font-bold">Connect to Gateway</h1>
				<p class="mt-1 text-sm text-slate-400">Enter your OpenClaw Gateway details</p>
			</div>

			<form on:submit|preventDefault={handleConnect} class="space-y-4">
				<div>
					<label for="gateway-url" class="block text-sm font-medium text-slate-300">
						Gateway URL
					</label>
					<input
						id="gateway-url"
						type="text"
						bind:value={url}
						placeholder="ws://127.0.0.1:18789"
						class="mt-1 block w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="gateway-token" class="block text-sm font-medium text-slate-300">
						Token
					</label>
					<input
						id="gateway-token"
						type="password"
						bind:value={token}
						placeholder="Gateway token"
						class="mt-1 block w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
				</div>

				{#if error}
					<p class="text-sm text-red-400">{error}</p>
				{/if}

				<button
					type="submit"
					disabled={connecting || !url || !token}
					class="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{connecting ? 'Connecting...' : 'Connect'}
				</button>
			</form>
		</div>
	</div>
{/if}
