import { PUBLIC_DEFAULT_GATEWAY_URL, PUBLIC_DEFAULT_TOKEN } from '$env/static/public';
import type { AuthParams, ConnectParams, DeviceParams } from './types';

const STORAGE_KEY_TOKEN = 'falcon-dash:gateway-token';
const STORAGE_KEY_URL = 'falcon-dash:gateway-url';
const STORAGE_KEY_DEVICE_ID = 'falcon-dash:device-id';

const DEFAULT_GATEWAY_URL = PUBLIC_DEFAULT_GATEWAY_URL || 'ws://127.0.0.1:18789';
const DEFAULT_TOKEN = PUBLIC_DEFAULT_TOKEN || '';
const PROTOCOL_VERSION = 3;
const CLIENT_VERSION = '0.1.0';

/** Store the gateway token in localStorage */
export function setToken(token: string): void {
	localStorage.setItem(STORAGE_KEY_TOKEN, token);
}

/** Retrieve the gateway token from localStorage, falling back to env default */
export function getToken(): string | null {
	return localStorage.getItem(STORAGE_KEY_TOKEN) || DEFAULT_TOKEN || null;
}

/** Store the gateway URL in localStorage */
export function setGatewayUrl(url: string): void {
	localStorage.setItem(STORAGE_KEY_URL, url);
}

/** Retrieve the gateway URL from localStorage */
export function getGatewayUrl(): string {
	return localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_GATEWAY_URL;
}

/** Get or create a stable device ID persisted in localStorage */
export function getDeviceId(): string {
	let id = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem(STORAGE_KEY_DEVICE_ID, id);
	}
	return id;
}

/** Generate a unique instance ID for this tab/session */
export function generateInstanceId(): string {
	return crypto.randomUUID();
}

/** Build auth params for the connect frame (dev mode: token-only) */
export function buildAuthParams(token: string): AuthParams {
	return { token };
}

/** Build the full connect params for the connect frame */
export function buildConnectParams(
	token: string,
	instanceId: string,
	device?: DeviceParams
): ConnectParams {
	return {
		minProtocol: PROTOCOL_VERSION,
		maxProtocol: PROTOCOL_VERSION,
		client: {
			id: 'openclaw-control-ui',
			version: CLIENT_VERSION,
			platform: 'web',
			mode: 'webchat',
			displayName: 'Falcon Dashboard',
			instanceId
		},
		role: 'operator',
		scopes: ['operator.read', 'operator.write'],
		caps: [],
		commands: [],
		permissions: {},
		auth: buildAuthParams(token),
		locale: navigator?.language || 'en-US',
		userAgent: `falcon-dash/${CLIENT_VERSION}`,
		device
	};
}
