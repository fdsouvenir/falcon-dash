import type {
	AgentEvent,
	AgentRunState,
	ChatMessage,
	ChatSendAck,
	ThinkingBlock,
	ToolCall
} from './types';

/**
 * Manages the two-stage chat.send response pattern:
 * 1. Ack (immediate) → registers active run
 * 2. Agent events (streaming) → routes by kind
 * 3. text_end (completion) → marks run complete
 */
export class AgentStreamManager {
	private runs = new Map<string, AgentRunState>();
	private sessionRuns = new Map<string, string>();
	private messages = new Map<string, ChatMessage>();

	onMessage: ((msg: ChatMessage) => void) | null = null;
	onRunComplete: ((runId: string) => void) | null = null;
	onRunError: ((runId: string, error: string) => void) | null = null;

	handleAck(sessionKey: string, ack: ChatSendAck): void {
		const run: AgentRunState = {
			runId: ack.runId,
			sessionKey,
			status: 'running',
			startedAt: Date.now(),
			seq: 0
		};
		this.runs.set(ack.runId, run);
		this.sessionRuns.set(sessionKey, ack.runId);

		const msg: ChatMessage = {
			id: `msg-stream-${ack.runId}`,
			sessionKey,
			role: 'assistant',
			content: '',
			timestamp: Date.now(),
			runId: ack.runId,
			thinking: [],
			toolCalls: []
		};
		this.messages.set(ack.runId, msg);
		this.onMessage?.(msg);
	}

	handleEvent(event: AgentEvent): void {
		const run = this.runs.get(event.runId);
		if (!run) return;

		const msg = this.messages.get(event.runId);
		if (!msg) return;

		switch (event.kind) {
			case 'text_delta':
				msg.content = event.content;
				break;

			case 'text_end':
				run.status = 'complete';
				this.onMessage?.(msg);
				this.onRunComplete?.(event.runId);
				this.cleanup(event.runId);
				return;

			case 'thinking':
				this.handleThinking(msg, event.content);
				break;

			case 'tool_start':
				this.handleToolStart(msg, event.toolName, event.args);
				break;

			case 'tool_result':
				this.handleToolResult(msg, event.toolName, event.result);
				break;
		}

		if ('seq' in event && typeof (event as Record<string, unknown>).seq === 'number') {
			run.seq = (event as Record<string, unknown>).seq as number;
		}

		this.onMessage?.(msg);
	}

	abort(sessionKey: string): void {
		const runId = this.sessionRuns.get(sessionKey);
		if (!runId) return;

		const run = this.runs.get(runId);
		if (run) {
			run.status = 'error';
		}

		this.onRunError?.(runId, 'Aborted by user');
		this.cleanup(runId);
	}

	reset(): void {
		this.runs.clear();
		this.sessionRuns.clear();
		this.messages.clear();
	}

	getActiveRun(sessionKey: string): AgentRunState | undefined {
		const runId = this.sessionRuns.get(sessionKey);
		if (!runId) return undefined;
		const run = this.runs.get(runId);
		if (run && run.status === 'running') return run;
		return undefined;
	}

	getStreamMessage(runId: string): ChatMessage | undefined {
		return this.messages.get(runId);
	}

	private handleThinking(msg: ChatMessage, content: string): void {
		if (!msg.thinking) msg.thinking = [];

		const last = msg.thinking[msg.thinking.length - 1];
		if (!last || last.completedAt !== undefined) {
			const block: ThinkingBlock = {
				content,
				startedAt: Date.now()
			};
			msg.thinking.push(block);
		} else {
			last.content += content;
		}
	}

	private handleToolStart(msg: ChatMessage, toolName: string, args: Record<string, unknown>): void {
		if (!msg.toolCalls) msg.toolCalls = [];

		const toolCall: ToolCall = {
			toolName,
			args,
			status: 'pending'
		};
		msg.toolCalls.push(toolCall);
	}

	private handleToolResult(msg: ChatMessage, toolName: string, result: unknown): void {
		if (!msg.toolCalls) return;

		for (let i = msg.toolCalls.length - 1; i >= 0; i--) {
			if (msg.toolCalls[i].toolName === toolName && msg.toolCalls[i].status === 'pending') {
				msg.toolCalls[i].result = result;
				msg.toolCalls[i].status = 'complete';
				break;
			}
		}
	}

	private cleanup(runId: string): void {
		const run = this.runs.get(runId);
		if (run) {
			this.sessionRuns.delete(run.sessionKey);
		}
		this.runs.delete(runId);
		this.messages.delete(runId);
	}
}
