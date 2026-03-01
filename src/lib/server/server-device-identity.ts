import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createPrivateKey, generateKeyPairSync, sign, createHash } from 'crypto';

const IDENTITY_DIR = join(homedir(), '.falcon-dash');
const IDENTITY_FILE = join(IDENTITY_DIR, 'server-identity.json');

interface StoredIdentity {
	deviceId: string;
	publicKeyBase64: string;
	privateKeyPem: string;
}

let cached: { deviceId: string; publicKeyBase64: string; privateKeyPem: string } | null = null;

function loadOrGenerate(): StoredIdentity {
	if (cached) return cached;

	try {
		const raw = readFileSync(IDENTITY_FILE, 'utf-8');
		const stored = JSON.parse(raw) as StoredIdentity;
		if (stored.deviceId && stored.publicKeyBase64 && stored.privateKeyPem) {
			cached = stored;
			return stored;
		}
	} catch {
		// File doesn't exist or is invalid — generate new identity
	}

	const { publicKey, privateKey } = generateKeyPairSync('ed25519');

	const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
	// Ed25519 SPKI DER: 12-byte header + 32-byte raw key
	const rawPublicKey = publicKeyDer.subarray(publicKeyDer.length - 32);
	const publicKeyBase64 = rawPublicKey.toString('base64');

	const deviceId = createHash('sha256').update(rawPublicKey).digest('hex');

	const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

	const identity: StoredIdentity = { deviceId, publicKeyBase64, privateKeyPem };

	mkdirSync(IDENTITY_DIR, { recursive: true });
	writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, '\t'), { mode: 0o600 });

	cached = identity;
	return identity;
}

export function ensureServerIdentity(): { deviceId: string; publicKeyBase64: string } {
	const { deviceId, publicKeyBase64 } = loadOrGenerate();
	return { deviceId, publicKeyBase64 };
}

export interface SignPayload {
	deviceId: string;
	clientId: string;
	clientMode: string;
	role: string;
	scopes: string[];
	signedAtMs: number;
	token: string | null;
	nonce: string;
}

export function buildSignMessage(p: SignPayload): string {
	const version = p.nonce ? 'v2' : 'v1';
	const scopesCsv = p.scopes.join(',');
	const token = p.token ?? '';
	const parts = [
		version,
		p.deviceId,
		p.clientId,
		p.clientMode,
		p.role,
		scopesCsv,
		String(p.signedAtMs),
		token
	];
	if (version === 'v2') parts.push(p.nonce ?? '');
	return parts.join('|');
}

export function signChallenge(message: string): string {
	const { privateKeyPem } = loadOrGenerate();
	const key = createPrivateKey(privateKeyPem);
	const sig = sign(null, Buffer.from(message), key);
	return sig.toString('base64');
}
