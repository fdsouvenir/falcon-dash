import { writable } from 'svelte/store';

const STORAGE_KEY = 'falcon-dash:gateway-token';
const URL_STORAGE_KEY = 'falcon-dash:gateway-url';
const DEFAULT_URL = 'ws://127.0.0.1:18789';

function loadToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(STORAGE_KEY);
}

function loadUrl(): string {
	if (typeof localStorage === 'undefined') return DEFAULT_URL;
	return localStorage.getItem(URL_STORAGE_KEY) || DEFAULT_URL;
}

function createTokenStore() {
	const { subscribe, set } = writable<string | null>(loadToken());

	return {
		subscribe,
		set(value: string | null) {
			if (typeof localStorage !== 'undefined') {
				if (value) {
					localStorage.setItem(STORAGE_KEY, value);
				} else {
					localStorage.removeItem(STORAGE_KEY);
				}
			}
			set(value);
		},
		clear() {
			if (typeof localStorage !== 'undefined') {
				localStorage.removeItem(STORAGE_KEY);
			}
			set(null);
		}
	};
}

function createUrlStore() {
	const { subscribe, set } = writable<string>(loadUrl());

	return {
		subscribe,
		set(value: string) {
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(URL_STORAGE_KEY, value);
			}
			set(value);
		}
	};
}

export const gatewayToken = createTokenStore();
export const gatewayUrl = createUrlStore();
