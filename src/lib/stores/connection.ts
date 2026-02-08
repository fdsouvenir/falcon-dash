import { derived, writable, type Readable } from 'svelte/store';
import { gateway } from '$lib/gateway';
import { ConnectionState } from '$lib/gateway/types';

/** Gateway URL currently configured */
export const gatewayUrl = writable<string>('');

/** Connection ID from hello-ok server.connId */
export const connId = writable<string>('');

/** Server version from hello-ok server.version */
export const serverVersion = writable<string>('');

/** Connection state derived from the gateway client */
export const connectionState: Readable<ConnectionState> = gateway.state;

/** Whether the connection is in a reconnecting state */
export const isReconnecting: Readable<boolean> = derived(connectionState, ($state) => {
	return $state === ConnectionState.RECONNECTING;
});
