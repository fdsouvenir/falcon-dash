import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Types expected by shadcn-svelte generated components
export type WithElementRef<T, E extends HTMLElement = HTMLElement> = T & {
	ref?: E | null;
};

export type WithoutChild<T> = Omit<T, 'child'>;

/** Generate an 8-character random hex string for session IDs */
export function shortId(): string {
	return Array.from(crypto.getRandomValues(new Uint8Array(4)))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
