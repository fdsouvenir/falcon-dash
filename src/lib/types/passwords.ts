export interface PasswordEntry {
	title: string;
	username?: string;
	url?: string;
	group?: string;
	icon?: string;
}

export interface PasswordEntryFull extends PasswordEntry {
	password: string;
	notes?: string;
	attributes?: Record<string, string>;
}

export type VaultStatus = 'unavailable' | 'locked' | 'first-run' | 'unlocked';

export interface VaultState {
	status: VaultStatus;
	entries?: PasswordEntry[];
}
