#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const latestDir = process.env.AGENT_LOOP_LATEST_DIR
	? path.resolve(root, process.env.AGENT_LOOP_LATEST_DIR)
	: path.join(root, 'artifacts', 'run-latest');
const historyDir = process.env.AGENT_LOOP_HISTORY_DIR
	? path.resolve(root, process.env.AGENT_LOOP_HISTORY_DIR)
	: latestDir;
const consoleLatestDir = path.join(latestDir, 'console');
const consoleHistoryDir = path.join(historyDir, 'console');
const manifestPath = path.join(root, 'harness', 'console-routes.json');
const baselinePath = path.join(root, 'harness', 'console-baseline.json');

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? null;
const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${port}`;

function nowIso() {
	return new Date().toISOString();
}

async function pathExists(targetPath) {
	try {
		await access(targetPath);
		return true;
	} catch {
		return false;
	}
}

async function writeBoth(relPath, content) {
	const latestPath = path.join(consoleLatestDir, relPath);
	const historyPath = path.join(consoleHistoryDir, relPath);
	await mkdir(path.dirname(latestPath), { recursive: true });
	await mkdir(path.dirname(historyPath), { recursive: true });
	await writeFile(latestPath, content);
	await writeFile(historyPath, content);
}

async function writeJson(relPath, data) {
	await writeBoth(relPath, `${JSON.stringify(data, null, 2)}\n`);
}

async function loadJson(filePath) {
	return JSON.parse(await readFile(filePath, 'utf8'));
}

function matchesBaseline(finding, baselineEntries) {
	return baselineEntries.some((entry) => {
		if (entry.kind && entry.kind !== finding.kind) return false;
		if (entry.routeId && entry.routeId !== finding.routeId) return false;
		if (entry.project && entry.project !== finding.project) return false;
		if (entry.pattern && !finding.message.includes(entry.pattern)) return false;
		return true;
	});
}

async function waitForReady(url, timeoutMs = 120000) {
	const deadline = Date.now() + timeoutMs;
	let lastError = null;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(`${url}/api/ready`);
			if (response.ok) return;
			lastError = new Error(`Unexpected status ${response.status}`);
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	throw lastError ?? new Error('Timed out waiting for dev server readiness.');
}

async function startDevServer() {
	if (externalBaseUrl) return null;

	const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
		cwd: root,
		env: process.env,
		stdio: 'pipe'
	});

	let serverLog = '';
	child.stdout.on('data', (chunk) => {
		serverLog += chunk.toString();
	});
	child.stderr.on('data', (chunk) => {
		serverLog += chunk.toString();
	});

	await waitForReady(baseUrl);

	return { child, serverLogRef: () => serverLog };
}

function waitForProcessClose(child, timeoutMs = 5000) {
	return new Promise((resolve) => {
		let settled = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			resolve('timeout');
		}, timeoutMs);

		child.once('close', () => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve('closed');
		});
	});
}

function buildProjectUse(playwright) {
	return {
		desktop: {
			name: 'desktop',
			options: { viewport: { width: 1440, height: 1024 } }
		},
		mobile: {
			name: 'mobile',
			options: { ...playwright.devices['Pixel 7'] }
		}
	};
}

function summarizeFindings(findings) {
	return {
		total: findings.length,
		errorCount: findings.filter((finding) => finding.severity === 'error').length,
		warningCount: findings.filter((finding) => finding.severity === 'warning').length,
		baselinedCount: findings.filter((finding) => finding.baselined).length
	};
}

function buildMarkdown(status) {
	const lines = [
		'# Console Sweep Findings',
		'',
		`- generated: \`${status.finishedAt}\``,
		`- overall: \`${status.overallStatus}\``,
		`- routes scanned: \`${status.routeCount}\``,
		`- total findings: \`${status.summary.total}\``,
		`- error findings: \`${status.summary.errorCount}\``,
		`- warning findings: \`${status.summary.warningCount}\``,
		`- baselined findings: \`${status.summary.baselinedCount}\``,
		''
	];

	if (status.findings.length === 0) {
		lines.push('No findings.');
		return `${lines.join('\n')}\n`;
	}

	for (const finding of status.findings) {
		lines.push(`## ${finding.routeId} (${finding.project})`);
		lines.push('');
		lines.push(`- kind: \`${finding.kind}\``);
		lines.push(`- severity: \`${finding.severity}\``);
		lines.push(`- baselined: \`${finding.baselined}\``);
		lines.push(`- route: \`${finding.path}\``);
		lines.push(`- message: ${finding.message}`);
		if (finding.screenshot)
			lines.push(`- screenshot: [${finding.screenshot}](./${finding.screenshot})`);
		lines.push('');
	}

	return `${lines.join('\n')}\n`;
}

async function main() {
	await mkdir(consoleLatestDir, { recursive: true });
	await mkdir(consoleHistoryDir, { recursive: true });

	const startedAt = nowIso();
	const manifest = await loadJson(manifestPath);
	const baseline = await loadJson(baselinePath);

	if (!(await pathExists(path.join(root, 'node_modules', '@playwright', 'test')))) {
		const status = {
			startedAt,
			finishedAt: nowIso(),
			overallStatus: 'skipped',
			reason: 'Playwright is not installed in node_modules for this workspace.',
			routeCount: 0,
			summary: { total: 0, errorCount: 0, warningCount: 0, baselinedCount: 0 },
			findings: []
		};
		await writeJson('status.json', status);
		await writeBoth(
			'findings.md',
			'# Console Sweep Findings\n\nSkipped: Playwright is not installed.\n'
		);
		console.log(status.reason);
		return;
	}

	const playwright = await import('@playwright/test');
	const { chromium } = playwright;
	const projects = buildProjectUse(playwright);
	const server = await startDevServer();
	const findings = [];
	const progress = [];

	try {
		const browser = await chromium.launch({ headless: true });

		for (const route of manifest.routes.filter((entry) => entry.offlineSafe)) {
			for (const projectName of route.projects) {
				const project = projects[projectName];
				const context = await browser.newContext(project.options);
				const page = await context.newPage();
				page.setDefaultNavigationTimeout(15000);
				page.setDefaultTimeout(15000);

				progress.push({
					routeId: route.id,
					project: project.name,
					startedAt: nowIso(),
					status: 'running'
				});
				await writeJson('progress.json', progress);

				page.on('console', (message) => {
					const type = message.type();
					if (type !== 'error' && type !== 'warning') return;
					findings.push({
						kind: `console.${type}`,
						severity: type === 'error' ? 'error' : 'warning',
						routeId: route.id,
						path: route.path,
						project: project.name,
						message: message.text(),
						baselined: false,
						screenshot: null
					});
				});

				page.on('pageerror', (error) => {
					findings.push({
						kind: 'pageerror',
						severity: 'error',
						routeId: route.id,
						path: route.path,
						project: project.name,
						message: error.stack || error.message,
						baselined: false,
						screenshot: null
					});
				});

				page.on('requestfailed', (request) => {
					findings.push({
						kind: 'requestfailed',
						severity: 'error',
						routeId: route.id,
						path: route.path,
						project: project.name,
						message: `${request.url()} :: ${request.failure()?.errorText ?? 'request failed'}`,
						baselined: false,
						screenshot: null
					});
				});

				try {
					await page.goto(`${baseUrl}${route.path}`, {
						waitUntil: 'domcontentloaded',
						timeout: 15000
					});
					await page.waitForTimeout(1500);
				} catch (error) {
					findings.push({
						kind: 'sweeperror',
						severity: 'error',
						routeId: route.id,
						path: route.path,
						project: project.name,
						message: error instanceof Error ? error.message : String(error),
						baselined: false,
						screenshot: null
					});
				}

				for (const finding of findings) {
					if (finding.routeId !== route.id || finding.project !== project.name) continue;
					finding.baselined = matchesBaseline(finding, baseline.entries);
				}

				const routeHasUnhandledError = findings.some(
					(finding) =>
						finding.routeId === route.id &&
						finding.project === project.name &&
						finding.severity === 'error' &&
						!finding.baselined
				);

				if (routeHasUnhandledError) {
					const screenshotName = `screenshots/${route.id}-${project.name}.png`;
					await writeBoth(screenshotName, '');
					const latestScreenshotPath = path.join(consoleLatestDir, screenshotName);
					const historyScreenshotPath = path.join(consoleHistoryDir, screenshotName);
					await page.screenshot({ path: latestScreenshotPath, fullPage: true });
					await page.screenshot({ path: historyScreenshotPath, fullPage: true });
					for (const finding of findings) {
						if (finding.routeId === route.id && finding.project === project.name) {
							finding.screenshot = screenshotName;
						}
					}
				}

				const progressEntry = progress.find(
					(entry) =>
						entry.routeId === route.id &&
						entry.project === project.name &&
						entry.status === 'running'
				);
				if (progressEntry) {
					progressEntry.status = 'completed';
					progressEntry.finishedAt = nowIso();
				}
				await writeJson('progress.json', progress);

				await context.close();
			}
		}

		await browser.close();
	} finally {
		if (server?.child) {
			server.child.kill('SIGTERM');
			const closeState = await waitForProcessClose(server.child, 5000);
			if (closeState === 'timeout') {
				server.child.kill('SIGKILL');
				await waitForProcessClose(server.child, 2000);
			}
			await writeBoth('dev-server.txt', `${server.serverLogRef()}\n`);
		}
	}

	const summary = summarizeFindings(findings);
	const overallStatus = findings.some(
		(finding) => finding.severity === 'error' && !finding.baselined
	)
		? 'failed'
		: 'success';

	const status = {
		startedAt,
		finishedAt: nowIso(),
		overallStatus,
		routeCount: manifest.routes.filter((entry) => entry.offlineSafe).length,
		summary,
		findings
	};

	await writeJson('findings.json', findings);
	await writeJson('status.json', status);
	await writeBoth('findings.md', buildMarkdown(status));

	if (overallStatus === 'failed') {
		console.error('Console sweep found unmatched error-level findings.');
		process.exit(1);
	}
}

await main();
