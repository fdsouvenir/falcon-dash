import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nativeIntegration } from '../integrations/native.mjs';
const client = () => ({
	connId: 'fixture',
	connect: { scopes: ['operator.write'] },
	internal: { operatorRoleActor: { kind: 'operator', profileId: 'owner' } }
});
test('Native connection creation derives its human actor and requires Vault ownership', async () => {
	let saved;
	const service = {
		vault: {
			authorize(actor, human) {
				assert.equal(actor, 'human:owner');
				assert.equal(human, true);
			}
		},
		create(input, actor) {
			saved = { input, actor };
			return { id: input.id };
		}
	};
	await nativeIntegration(
		service,
		null,
		{
			action: 'create',
			input: {
				id: 'one',
				provider: 'cloudflare',
				purpose: 'Synthetic fixture',
				account_id: 'account',
				vault_handle: 'one',
				actors: ['agent:worker']
			}
		},
		client(),
		() => {}
	);
	assert.deepEqual(saved.input.actors, ['human:owner', 'agent:worker']);
	assert.equal(saved.input.owner, 'falcon');
	await assert.rejects(
		nativeIntegration(
			service,
			null,
			{ action: 'create', input: {} },
			{ ...client(), internal: { ...client().internal, syntheticClient: true } },
			() => {}
		),
		{ code: 'identity_required' }
	);
});
test('Native OAuth fails explicitly without a configured callback and rechecks connection after async consent', async () => {
	const params = {
			action: 'consent',
			input: {
				connection_id: 'one',
				redirect_uri: 'https://fixture.invalid/callback',
				scopes: ['locations.readonly']
			}
		},
		c = client();
	await assert.rejects(
		nativeIntegration({}, null, params, c, () => {}),
		{ code: 'unavailable' }
	);
	await assert.rejects(
		nativeIntegration(
			{},
			{
				async begin() {
					c.invalidated = true;
					return { authorization_url: 'https://fixture.invalid' };
				}
			},
			params,
			c,
			() => {}
		),
		{ code: 'authority_changed' }
	);
});
