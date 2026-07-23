import { randomBytes } from 'node:crypto';

/**
 * Monotonic ULID generator (Crockford base32, 10 time chars + 16 random chars).
 * Implemented locally to avoid a dependency; monotonic within a process so
 * Event Log ordering by id matches emission order even inside one millisecond.
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LEN = 10;
const RANDOM_LEN = 16;

let lastTime = -1;
let lastRandom: number[] = [];

function encodeTime(time: number): string {
	let out = '';
	for (let i = TIME_LEN - 1; i >= 0; i--) {
		out = ENCODING[time % 32] + out;
		time = Math.floor(time / 32);
	}
	return out;
}

function freshRandom(): number[] {
	const bytes = randomBytes(RANDOM_LEN);
	return Array.from(bytes, (b) => b % 32);
}

function incrementRandom(values: number[]): number[] {
	const next = [...values];
	for (let i = next.length - 1; i >= 0; i--) {
		if (next[i] < 31) {
			next[i] += 1;
			return next;
		}
		next[i] = 0;
	}
	// Overflow within one millisecond is practically unreachable; start fresh.
	return freshRandom();
}

export function ulid(now: number = Date.now()): string {
	if (now === lastTime) {
		lastRandom = incrementRandom(lastRandom);
	} else {
		lastTime = now;
		lastRandom = freshRandom();
	}
	return encodeTime(now) + lastRandom.map((v) => ENCODING[v]).join('');
}
