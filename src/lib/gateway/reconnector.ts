import type { GatewayConnection } from './connection.js';
import type { EventBus } from './event-bus.js';
import type { ConnectionConfig } from './types.js';

const BACKOFF_BASE_MS = 800;
const BACKOFF_MULTIPLIER = 1.7;
const BACKOFF_CAP_MS = 15_000;

export class Reconnector {
	private connection: GatewayConnection;
	private eventBus: EventBus;
	private config: ConnectionConfig | null = null;
	private attempt = 0;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private tickTimer: ReturnType<typeof setTimeout> | null = null;
	private tickIntervalMs: number | null = null;
	private enabled = false;
	private shutdownDelay: number | null = null;
	private unsubscribers: Array<() => void> = [];

	constructor(connection: GatewayConnection, eventBus: EventBus) {
		this.connection = connection;
		this.eventBus = eventBus;
	}

	/**
	 * Enable automatic reconnection. Call after initial connect succeeds.
	 */
	enable(config: ConnectionConfig): void {
		this.config = config;
		this.enabled = true;
		this.attempt = 0;
		this.subscribeToEvents();
	}

	/**
	 * Disable automatic reconnection and cancel any pending retry.
	 */
	disable(): void {
		this.enabled = false;
		this.cancelTimer();
		this.cancelTickTimer();
		this.unsubscribeAll();
	}

	/**
	 * Called when hello-ok is received (on connect or reconnect).
	 * Resets attempt counter and starts tick monitoring.
	 */
	onConnected(tickIntervalMs: number): void {
		this.attempt = 0;
		this.shutdownDelay = null;
		this.tickIntervalMs = tickIntervalMs;
		this.resetTickTimer();
	}

	/**
	 * Trigger a reconnection attempt. Sets state to RECONNECTING and schedules retry.
	 */
	scheduleReconnect(): void {
		if (!this.enabled || !this.config) return;

		this.cancelTickTimer();
		this.connection.setConnectionState('RECONNECTING');

		const delay = this.getDelay();
		this.attempt++;

		this.timer = setTimeout(() => {
			this.timer = null;
			if (this.enabled && this.config) {
				this.connection.connect(this.config);
			}
		}, delay);
	}

	private subscribeToEvents(): void {
		this.unsubscribeAll();

		// Listen for shutdown events
		this.unsubscribers.push(
			this.eventBus.on('shutdown', (payload) => {
				const restartExpectedMs = payload.restartExpectedMs as number | undefined;
				if (restartExpectedMs != null && restartExpectedMs > 0) {
					this.shutdownDelay = restartExpectedMs;
				}
			})
		);

		// Listen for tick events to reset the tick timer
		this.unsubscribers.push(
			this.eventBus.on('tick', () => {
				this.resetTickTimer();
			})
		);
	}

	/**
	 * Reset the tick timeout timer. If no tick is received within 2x tickIntervalMs,
	 * assume connection lost and trigger reconnection.
	 */
	private resetTickTimer(): void {
		this.cancelTickTimer();
		if (this.tickIntervalMs == null || !this.enabled) return;

		const timeout = this.tickIntervalMs * 2;
		this.tickTimer = setTimeout(() => {
			this.tickTimer = null;
			// Tick timeout — connection assumed lost
			this.scheduleReconnect();
		}, timeout);
	}

	/**
	 * Called when the WebSocket closes unexpectedly (not from user disconnect).
	 */
	onDisconnect(): void {
		this.cancelTickTimer();
		if (this.enabled) {
			this.scheduleReconnect();
		}
	}

	private getDelay(): number {
		// If we have a shutdown delay from a shutdown event, use it for the first attempt
		if (this.shutdownDelay != null && this.attempt === 0) {
			return this.shutdownDelay;
		}

		const delay = BACKOFF_BASE_MS * Math.pow(BACKOFF_MULTIPLIER, this.attempt);
		return Math.min(delay, BACKOFF_CAP_MS);
	}

	private cancelTimer(): void {
		if (this.timer != null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	private cancelTickTimer(): void {
		if (this.tickTimer != null) {
			clearTimeout(this.tickTimer);
			this.tickTimer = null;
		}
	}

	private unsubscribeAll(): void {
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
	}
}
