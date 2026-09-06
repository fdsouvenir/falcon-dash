import { requireValue } from './errors.mjs';
/** @typedef {{assert:()=>void,signal?:AbortSignal,beforeRequest?:()=>void}} Authority */
/** @type {Authority} */
export const internalAuthority = Object.freeze({ assert() {}, signal: undefined });
export function connectionAuthority(client) {
	const identity = client?.internal?.operatorRoleActor;
	const scopes = JSON.stringify([...(client?.connect?.scopes ?? [])].sort());
	const kind = identity?.kind,
		profileId = identity?.profileId,
		connId = client?.connId,
		synthetic = client?.internal?.syntheticClient;
	return Object.freeze({
		signal: client?.connectionSignal,
		assert() {
			requireValue(
				!client?.invalidated &&
					!client?.connectionSignal?.aborted &&
					client?.connId === connId &&
					client?.internal?.operatorRoleActor?.kind === kind &&
					client?.internal?.operatorRoleActor?.profileId === profileId &&
					client?.internal?.syntheticClient === synthetic &&
					JSON.stringify([...(client?.connect?.scopes ?? [])].sort()) === scopes,
				'authority_changed',
				'Original connection authority is no longer valid'
			);
		}
	});
}
