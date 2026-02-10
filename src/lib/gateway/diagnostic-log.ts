import { writable, derived, readonly, type Readable } from 'svelte/store';

export type DiagnosticCategory = 'connection' | 'auth' | 'reconnect' | 'tick' | 'request' | 'error';

export type DiagnosticLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DiagnosticEvent {
	ts: number;
	category: DiagnosticCategory;
	level: DiagnosticLevel;
	message: string;
	detail?: Record<string, unknown>;
}

const MAX_ENTRIES = 200;

export class DiagnosticLog {
	private buffer: DiagnosticEvent[] = [];
	private _entries = writable<DiagnosticEvent[]>([]);

	/** Current log entries as a Svelte readable store */
	readonly entries: Readable<DiagnosticEvent[]> = readonly(this._entries);

	/** Count of error-level entries */
	readonly errorCount: Readable<number> = derived(this._entries, (entries) =>
		entries.reduce((n, e) => n + (e.level === 'error' ? 1 : 0), 0)
	);

	/** Count of warn-level entries */
	readonly warnCount: Readable<number> = derived(this._entries, (entries) =>
		entries.reduce((n, e) => n + (e.level === 'warn' ? 1 : 0), 0)
	);

	/** Add an event to the ring buffer and update the store */
	log(
		category: DiagnosticCategory,
		level: DiagnosticLevel,
		message: string,
		detail?: Record<string, unknown>
	): void {
		const event: DiagnosticEvent = { ts: Date.now(), category, level, message, detail };
		this.buffer.push(event);
		if (this.buffer.length > MAX_ENTRIES) {
			this.buffer = this.buffer.slice(-MAX_ENTRIES);
		}
		this._entries.set([...this.buffer]);
	}

	/** Clear all entries */
	clear(): void {
		this.buffer = [];
		this._entries.set([]);
	}

	/** Export entries as a JSON string (for copy-to-clipboard) */
	export(): string {
		return JSON.stringify(this.buffer, null, 2);
	}
}

/** Singleton diagnostic log instance */
export const diagnosticLog = new DiagnosticLog();
