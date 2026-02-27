import { writable, derived } from 'svelte/store';
import { call } from '$lib/stores/gateway.js';

export interface SecretProvider {
	type: 'env' | 'file' | 'exec';
	name?: string;
	path?: string;
	mode?: string;
	command?: string;
	args?: string[];
	timeout?: number;
}

export interface SecretField {
	key: string;
	provider?: string;
	id?: string;
	resolved: boolean;
	error?: string;
}

export interface SecretsState {
	providers: SecretProvider[];
	fields: SecretField[];
	loading: boolean;
	error: string | null;
}

const _state = writable<SecretsState>({
	providers: [],
	fields: [],
	loading: false,
	error: null
});

export const secrets = {
	subscribe: _state.subscribe,
	providers: derived(_state, (s) => s.providers),
	fields: derived(_state, (s) => s.fields),
	loading: derived(_state, (s) => s.loading),
	error: derived(_state, (s) => s.error)
};

export async function loadSecrets(): Promise<void> {
	_state.update((s) => ({ ...s, loading: true, error: null }));
	try {
		const result = await call<{ config: string; hash: string }>('config.get', {});
		const config = JSON.parse(result.config);
		const secretsConfig = config.secrets ?? {};

		const providers: SecretProvider[] = [];
		if (secretsConfig.providers) {
			for (const [, provider] of Object.entries(secretsConfig.providers)) {
				providers.push(provider as SecretProvider);
			}
		}

		_state.set({
			providers,
			fields: [], // Populated by audit if available
			loading: false,
			error: null
		});
	} catch (err) {
		_state.update((s) => ({ ...s, loading: false, error: String(err) }));
	}
}

export async function addProvider(provider: SecretProvider): Promise<void> {
	const result = await call<{ config: string; hash: string }>('config.get', {});
	const config = JSON.parse(result.config);
	if (!config.secrets) config.secrets = {};
	if (!config.secrets.providers) config.secrets.providers = {};

	const name = provider.name || `${provider.type}-${Date.now()}`;
	config.secrets.providers[name] = provider;

	await call('config.apply', {
		raw: JSON.stringify(config, null, 2),
		baseHash: result.hash
	});
	await loadSecrets();
}

export async function removeProvider(name: string): Promise<void> {
	const result = await call<{ config: string; hash: string }>('config.get', {});
	const config = JSON.parse(result.config);
	if (config.secrets?.providers?.[name]) {
		delete config.secrets.providers[name];
		await call('config.apply', {
			raw: JSON.stringify(config, null, 2),
			baseHash: result.hash
		});
		await loadSecrets();
	}
}
