import { Type, Check } from '../schema.mjs';
import { requireValue } from '../errors.mjs';
import { connectionAuthority } from '../authority.mjs';
const S = Type.String({ minLength: 1, maxLength: 512 }),
	O = (p) => Type.Object(p, { additionalProperties: false });
export const protectedInputs = {
	inventory: O({ group: Type.String({ maxLength: 512 }) }),
	initialize: O({}),
	unlock: O({}),
	lock: O({}),
	create: O({
		id: S,
		material: Type.Record(
			Type.String({ pattern: '^[a-z_]{1,80}$' }),
			Type.String({ maxLength: 65536 }),
			{ minProperties: 1, maxProperties: 20 }
		)
	}),
	rotate: O({
		id: S,
		expected_version: Type.Integer({ minimum: 1 }),
		material: Type.Record(
			Type.String({ pattern: '^[a-z_]{1,80}$' }),
			Type.String({ maxLength: 65536 }),
			{ minProperties: 1, maxProperties: 20 }
		)
	}),
	group: O({ id: S }),
	reveal: O({ id: S, field: S }),
	copy: O({ id: S, field: S }),
	grant: O({
		id: S,
		expected_version: Type.Integer({ minimum: 1 }),
		executors: Type.Array(S, { maxItems: 100 })
	}),
	revoke: O({ id: S, expected_version: Type.Integer({ minimum: 1 }) }),
	restore: O({ id: S, expected_version: Type.Integer({ minimum: 1 }) })
};
// Deliberately not a tool or feature query: selected-value reads require an explicit human call.
export async function protectedVault(vault, params, client, ready) {
	const identity = client?.internal?.operatorRoleActor;
	requireValue(
		client?.connId &&
			!client.invalidated &&
			!client.internal?.syntheticClient &&
			identity?.kind === 'operator',
		'identity_required',
		'Verified human connection required'
	);
	const actor = `human:${identity.profileId}`,
		original = connectionAuthority(client),
		authority = {
			signal: original.signal,
			assert() {
				ready();
				original.assert();
				requireValue(vault.owners.has(actor), 'access_denied', 'Vault owner access required');
			}
		};
	authority.assert();
	requireValue(
		params &&
			Object.keys(params).every((k) => ['action', 'input'].includes(k)) &&
			Object.hasOwn(protectedInputs, params.action) &&
			Check(protectedInputs[params.action], params.input),
		'invalid_input',
		'Invalid protected operation'
	);
	const p = params.input;
	let result;
	switch (params.action) {
		case 'inventory':
			result = await vault.inventory(actor, p.group, authority);
			break;
		case 'initialize':
			result = await vault.initialize(actor, authority);
			break;
		case 'unlock':
			result = await vault.unlock(actor, authority);
			break;
		case 'lock':
			result = await vault.lock(actor, authority);
			break;
		case 'create':
			result = await vault.create(p.id, p.material, actor, authority);
			break;
		case 'rotate':
			result = await vault.rotate(
				p.id,
				p.material,
				p.expected_version,
				actor,
				undefined,
				authority
			);
			break;
		case 'group':
			result = await vault.createGroup(p.id, actor, authority);
			break;
		case 'reveal':
			result = { value: await vault.revealField(p.id, p.field, actor, authority) };
			break;
		case 'copy':
			result = { value: await vault.copyField(p.id, p.field, actor, authority) };
			break;
		case 'grant':
			result = await vault.grantEntryExecutors(
				p.id,
				p.expected_version,
				p.executors,
				actor,
				authority
			);
			break;
		case 'revoke':
			result = await vault.revokeEntryExecution(p.id, p.expected_version, actor, authority);
			break;
		case 'restore':
			result = await vault.restoreEntryExecution(p.id, p.expected_version, actor, authority);
			break;
	}
	authority.assert();
	return result;
}
