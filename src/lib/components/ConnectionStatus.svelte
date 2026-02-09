<script lang="ts">
	import { connectionState } from '$lib/stores';
	import { ConnectionState } from '$lib/gateway/types';

	let state = $derived($connectionState);

	let dotColor = $derived(getDotColor(state));
	let label = $derived(getLabel(state));

	function getDotColor(s: ConnectionState): string {
		switch (s) {
			case ConnectionState.READY:
			case ConnectionState.CONNECTED:
				return 'bg-green-500';
			case ConnectionState.CONNECTING:
			case ConnectionState.AUTHENTICATING:
			case ConnectionState.RECONNECTING:
				return 'bg-yellow-500';
			case ConnectionState.DISCONNECTED:
			case ConnectionState.AUTH_FAILED:
			case ConnectionState.PAIRING_REQUIRED:
			default:
				return 'bg-red-500';
		}
	}

	function getLabel(s: ConnectionState): string {
		switch (s) {
			case ConnectionState.READY:
				return 'Connected';
			case ConnectionState.CONNECTED:
				return 'Connected';
			case ConnectionState.CONNECTING:
				return 'Connecting';
			case ConnectionState.AUTHENTICATING:
				return 'Authenticating';
			case ConnectionState.RECONNECTING:
				return 'Reconnecting';
			case ConnectionState.PAIRING_REQUIRED:
				return 'Pairing Required';
			case ConnectionState.AUTH_FAILED:
				return 'Auth Failed';
			case ConnectionState.DISCONNECTED:
			default:
				return 'Disconnected';
		}
	}
</script>

<div
	class="flex items-center gap-2 px-2 py-1.5"
	role="status"
	aria-live="polite"
	aria-label="Connection status: {label}"
>
	<span class="inline-block h-2 w-2 rounded-full {dotColor}" aria-hidden="true"></span>
	<span class="text-xs text-slate-400">{label}</span>
</div>
