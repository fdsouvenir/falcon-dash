import type { ConsoleMessage, Page } from '@playwright/test';
import { expect } from '@playwright/test';

const WS_ERROR_PATTERN =
	/WebSocket|ws:\/\/|ECONNREFUSED|ERR_CONNECTION_REFUSED|Failed to load resource/;

export class ConsoleErrorCollector {
	readonly errors: string[] = [];

	attach(page: Page): void {
		page.on('console', (msg: ConsoleMessage) => {
			if (msg.type() === 'error') {
				this.errors.push(msg.text());
			}
		});
	}

	expectNoErrors(): void {
		const real = this.errors.filter((e) => !WS_ERROR_PATTERN.test(e));
		expect(real).toEqual([]);
	}
}

export async function suppressOnboarding(page: Page): Promise<void> {
	await page.addInitScript(() => {
		localStorage.setItem('falcon-dash:onboarding-completed', 'true');
		localStorage.setItem('falcon-dash:gateway-url', 'ws://127.0.0.1:18789');
	});
}

export async function loadPage(page: Page, path: string): Promise<ConsoleErrorCollector> {
	const collector = new ConsoleErrorCollector();
	collector.attach(page);
	await suppressOnboarding(page);
	const response = await page.goto(path, { waitUntil: 'networkidle' });
	expect(response?.status()).toBe(200);
	return collector;
}
