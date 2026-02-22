import type { EventBus } from './event-bus.js';

// Agent stream event types
export type StreamEventType = 'messageStart' | 'delta' | 'toolCall' | 'toolResult' | 'messageEnd';

export interface StreamEvent {
	type: StreamEventType;
	runId: string;
	sessionKey?: string;
	ts: number;
}

export interface MessageStartEvent extends StreamEvent {
	type: 'messageStart';
}

export interface DeltaEvent extends StreamEvent {
	type: 'delta';
	text: string; // full accumulated text
	thinkingText?: string; // accumulated thinking text
}

export interface ToolCallEvent extends StreamEvent {
	type: 'toolCall';
	toolCallId: string;
	name: string;
	args: Record<string, unknown>;
}

export interface ToolResultEvent extends StreamEvent {
	type: 'toolResult';
	toolCallId: string;
	name: string;
	output: unknown;
	isError?: boolean;
	errorMessage?: string;
}

export interface MessageEndEvent extends StreamEvent {
	type: 'messageEnd';
	status: 'ok' | 'error' | 'aborted';
	summary?: string;
	errorMessage?: string;
}

export type AnyStreamEvent =
	| MessageStartEvent
	| DeltaEvent
	| ToolCallEvent
	| ToolResultEvent
	| MessageEndEvent;

// Active run state
interface ActiveRun {
	runId: string;
	sessionKey?: string;
	lastSeq: number;
	text: string;
	thinkingText: string;
	seqGaps: number[];
	startedAt: number;
}

// Stream event handler type
type StreamHandler = (event: AnyStreamEvent) => void;

export class AgentStreamManager {
	private runs = new Map<string, ActiveRun>();
	private handlers: StreamHandler[] = [];
	private unsubscribers: Array<() => void> = [];

	/**
	 * Subscribe to EventBus for agent and chat events.
	 */
	subscribe(eventBus: EventBus): void {
		this.unsubscribeAll();

		// Listen for agent events
		this.unsubscribers.push(
			eventBus.on('agent', (payload) => {
				this.handleAgentEvent(payload);
			})
		);

		// Listen for chat events (contains accumulated text deltas)
		this.unsubscribers.push(
			eventBus.on('chat', (payload) => {
				this.handleChatEvent(payload);
			})
		);
	}

	/**
	 * Register a handler for stream events.
	 * Returns an unsubscribe function.
	 */
	on(handler: StreamHandler): () => void {
		this.handlers.push(handler);
		return () => {
			const idx = this.handlers.indexOf(handler);
			if (idx >= 0) this.handlers.splice(idx, 1);
		};
	}

	/**
	 * Called when chat.send ack is received ({ runId, status: 'started' }).
	 */
	onAck(runId: string, sessionKey?: string): void {
		const run: ActiveRun = {
			runId,
			sessionKey,
			lastSeq: -1,
			text: '',
			thinkingText: '',
			seqGaps: [],
			startedAt: Date.now()
		};
		this.runs.set(runId, run);
		this.emit({ type: 'messageStart', runId, sessionKey, ts: Date.now() });
	}

	/**
	 * Called when final response is received ({ runId, status: 'ok'|'error' }).
	 */
	onFinal(
		runId: string,
		status: 'ok' | 'error' | 'aborted',
		summary?: string,
		errorMessage?: string
	): void {
		const run = this.runs.get(runId);
		this.emit({
			type: 'messageEnd',
			runId,
			sessionKey: run?.sessionKey,
			ts: Date.now(),
			status,
			summary,
			errorMessage
		});
		this.runs.delete(runId);
	}

	/**
	 * Get active run IDs.
	 */
	getActiveRuns(): string[] {
		return Array.from(this.runs.keys());
	}

	/**
	 * Check if a run is active.
	 */
	isActive(runId: string): boolean {
		return this.runs.has(runId);
	}

	/**
	 * Get seq gaps for a run (for debugging/monitoring).
	 */
	getSeqGaps(runId: string): number[] {
		return this.runs.get(runId)?.seqGaps ?? [];
	}

	/**
	 * Clear all active runs and unsubscribe.
	 */
	clear(): void {
		// Emit messageEnd for any active runs
		for (const [runId, run] of this.runs) {
			this.emit({
				type: 'messageEnd',
				runId,
				sessionKey: run.sessionKey,
				ts: Date.now(),
				status: 'aborted'
			});
		}
		this.runs.clear();
		this.unsubscribeAll();
	}

	private handleAgentEvent(payload: Record<string, unknown>): void {
		const runId = payload.runId as string;
		if (!runId) return;

		let run = this.runs.get(runId);
		if (!run) {
			// Auto-create run if we missed the ack
			run = {
				runId,
				sessionKey: payload.sessionKey as string | undefined,
				lastSeq: -1,
				text: '',
				thinkingText: '',
				seqGaps: [],
				startedAt: Date.now()
			};
			this.runs.set(runId, run);
			this.emit({ type: 'messageStart', runId, sessionKey: run.sessionKey, ts: Date.now() });
		}

		// Detect seq gaps
		const seq = payload.seq as number;
		if (seq != null && run.lastSeq >= 0 && seq > run.lastSeq + 1) {
			for (let i = run.lastSeq + 1; i < seq; i++) {
				run.seqGaps.push(i);
			}
		}
		if (seq != null) {
			run.lastSeq = Math.max(run.lastSeq, seq);
		}

		const stream = payload.stream as string;
		const data = (payload.data ?? {}) as Record<string, unknown>;

		if (stream === 'thinking') {
			// Thinking stream: data.text (accumulated), data.delta (incremental)
			const thinkingText = (data.text ?? '') as string;
			if (thinkingText.length >= run.thinkingText.length) {
				run.thinkingText = thinkingText;
			}
			this.emit({
				type: 'delta',
				runId,
				sessionKey: run.sessionKey,
				ts: (payload.ts as number) ?? Date.now(),
				text: run.text,
				thinkingText: run.thinkingText
			});
		} else if (stream === 'assistant') {
			// Text delta: data.text (accumulated), data.delta (incremental)
			const text = (data.text ?? '') as string;
			if (text.length >= run.text.length) {
				run.text = text;
			}
			this.emit({
				type: 'delta',
				runId,
				sessionKey: run.sessionKey,
				ts: (payload.ts as number) ?? Date.now(),
				text: run.text,
				thinkingText: run.thinkingText
			});
		} else if (stream === 'tool') {
			// Tool events use data.phase: "start" | "update" | "result"
			const phase = data.phase as string;
			if (phase === 'start') {
				this.emit({
					type: 'toolCall',
					runId,
					sessionKey: run.sessionKey,
					ts: (payload.ts as number) ?? Date.now(),
					toolCallId: (data.toolCallId ?? '') as string,
					name: (data.name ?? '') as string,
					args: (data.args ?? {}) as Record<string, unknown>
				});
			} else if (phase === 'result') {
				const isError = !!data.isError;
				this.emit({
					type: 'toolResult',
					runId,
					sessionKey: run.sessionKey,
					ts: (payload.ts as number) ?? Date.now(),
					toolCallId: (data.toolCallId ?? '') as string,
					name: (data.name ?? '') as string,
					output: data.result,
					isError,
					errorMessage: isError ? ((data.meta ?? '') as string) : undefined
				});
			}
		} else if (stream === 'lifecycle') {
			if (data.phase === 'end') {
				// Lifecycle end — final response should follow
			}
		}
	}

	private handleChatEvent(payload: Record<string, unknown>): void {
		const runId = payload.runId as string;
		if (!runId) return;

		const run = this.runs.get(runId);
		if (!run) return;

		const state = payload.state as string;

		if (state === 'delta') {
			const message = payload.message as
				| {
						content?: Array<{ type?: string; text?: string; thinking?: string }>;
				  }
				| undefined;
			const contentBlocks = message?.content ?? [];
			// Extract text from non-thinking blocks
			const text = contentBlocks
				.filter((b) => b.type !== 'thinking')
				.map((b) => b.text ?? '')
				.join('');
			if (text.length >= run.text.length) {
				run.text = text;
			}
			// Extract thinking from thinking blocks
			const thinking = contentBlocks
				.filter((b) => b.type === 'thinking' && b.thinking)
				.map((b) => b.thinking!)
				.join('\n');
			if (thinking.length > run.thinkingText.length) {
				run.thinkingText = thinking;
			}
			this.emit({
				type: 'delta',
				runId,
				sessionKey: run.sessionKey,
				ts: Date.now(),
				text: run.text,
				thinkingText: run.thinkingText
			});
		} else if (state === 'final') {
			this.onFinal(runId, 'ok');
		} else if (state === 'aborted') {
			this.onFinal(runId, 'aborted');
		} else if (state === 'error') {
			this.onFinal(runId, 'error', undefined, payload.errorMessage as string);
		}
	}

	private emit(event: AnyStreamEvent): void {
		for (const handler of this.handlers) {
			handler(event);
		}
	}

	private unsubscribeAll(): void {
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
	}
}
