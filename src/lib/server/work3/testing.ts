import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeWork3Dbs } from './db.js';
import { stopWork3OutboxWorker } from './outbox.js';
import { resetRegistryForTests } from './engine/registry.js';
import { setAuthoritySourceResolver } from './engine/authority.js';
import { resetObjectReadersForTests } from './read/registry.js';
import { resetWork3StartedForTests } from './index.js';

/**
 * Shared test harness for work3 suites: temp-dir databases via env override
 * (the v2 test convention), full module reset between tests.
 */

export interface Work3TestContext {
	tempDir: string;
}

export function setupWork3TestDbs(): Work3TestContext {
	const tempDir = mkdtempSync(join(tmpdir(), 'falcon-work3-'));
	process.env.FALCON_DASH_WORK3_DATABASE_PATH = join(tempDir, 'work3.db');
	process.env.FALCON_DASH_WORK3_EVENTS_DATABASE_PATH = join(tempDir, 'work3-events.db');
	closeWork3Dbs();
	return { tempDir };
}

export function teardownWork3TestDbs(context: Work3TestContext): void {
	stopWork3OutboxWorker();
	closeWork3Dbs();
	resetRegistryForTests();
	resetObjectReadersForTests();
	setAuthoritySourceResolver(async () => true);
	resetWork3StartedForTests();
	delete process.env.FALCON_DASH_WORK3_DATABASE_PATH;
	delete process.env.FALCON_DASH_WORK3_EVENTS_DATABASE_PATH;
	rmSync(context.tempDir, { recursive: true, force: true });
}
