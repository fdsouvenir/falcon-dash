const DB_NAME = 'falcon-dash';
const STORE_NAME = 'device-identity';

export interface DeviceIdentity {
	publicKey: CryptoKey;
	privateKey: CryptoKey;
	deviceId: string;
	deviceToken?: string;
}

// Open IndexedDB
function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			req.result.createObjectStore(STORE_NAME);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

// Generate Ed25519 keypair
export async function generateKeypair(): Promise<{
	publicKey: CryptoKey;
	privateKey: CryptoKey;
}> {
	const keyPair = await crypto.subtle.generateKey(
		{ name: 'Ed25519' },
		false, // not extractable for private key security
		['sign', 'verify']
	);
	return keyPair as { publicKey: CryptoKey; privateKey: CryptoKey };
}

// Derive device ID from public key fingerprint
export async function deriveDeviceId(publicKey: CryptoKey): Promise<string> {
	const exported = await crypto.subtle.exportKey('raw', publicKey);
	const hash = await crypto.subtle.digest('SHA-256', exported);
	const bytes = new Uint8Array(hash);
	return Array.from(bytes.slice(0, 16))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

// Export public key as base64 for the connect frame wire format
export async function exportPublicKeyBase64(publicKey: CryptoKey): Promise<string> {
	const exported = await crypto.subtle.exportKey('raw', publicKey);
	return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

// Sign challenge nonce
export async function signChallenge(privateKey: CryptoKey, nonce: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(nonce);
	const signature = await crypto.subtle.sign('Ed25519', privateKey, data);
	return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// Store identity in IndexedDB
export async function storeIdentity(identity: DeviceIdentity): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).put(
			{
				deviceId: identity.deviceId,
				deviceToken: identity.deviceToken
			},
			'identity'
		);
		// Store keys separately since CryptoKey can't be structured-cloned in all browsers
		tx.objectStore(STORE_NAME).put(identity.publicKey, 'publicKey');
		tx.objectStore(STORE_NAME).put(identity.privateKey, 'privateKey');
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

// Load identity from IndexedDB
export async function loadIdentity(): Promise<DeviceIdentity | null> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly');
		const store = tx.objectStore(STORE_NAME);
		const idReq = store.get('identity');
		const pubReq = store.get('publicKey');
		const privReq = store.get('privateKey');
		tx.oncomplete = () => {
			if (!idReq.result || !pubReq.result || !privReq.result) {
				resolve(null);
				return;
			}
			resolve({
				deviceId: idReq.result.deviceId,
				deviceToken: idReq.result.deviceToken,
				publicKey: pubReq.result,
				privateKey: privReq.result
			});
		};
		tx.onerror = () => reject(tx.error);
	});
}

// Store device token (from hello-ok)
export async function storeDeviceToken(token: string): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const store = tx.objectStore(STORE_NAME);
		const req = store.get('identity');
		req.onsuccess = () => {
			const data = req.result ?? {};
			data.deviceToken = token;
			store.put(data, 'identity');
		};
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

// Get or create device identity
export async function ensureDeviceIdentity(): Promise<DeviceIdentity> {
	try {
		const existing = await loadIdentity();
		if (existing) return existing;
	} catch (err) {
		console.warn('[DeviceIdentity] Failed to load from IndexedDB:', err);
	}

	const { publicKey, privateKey } = await generateKeypair();
	const deviceId = await deriveDeviceId(publicKey);
	const identity: DeviceIdentity = { publicKey, privateKey, deviceId };

	try {
		await storeIdentity(identity);
	} catch (err) {
		console.warn('[DeviceIdentity] Failed to persist identity:', err);
	}

	return identity;
}
