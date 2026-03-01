import * as Sentry from '@sentry/sveltekit';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { startContextScheduler } from '$lib/server/pm/context-scheduler.js';
import { startTerminalServer } from '$lib/server/terminal-server.js';
import { startGatewayClient } from '$lib/server/gateway-client.js';

Sentry.init({
	dsn: __SENTRY_DSN__,
	release: __APP_VERSION__,
	environment: __SENTRY_ENVIRONMENT__,
	enabled: !!__SENTRY_DSN__,
	tracesSampleRate: 0
});

startContextScheduler();
startTerminalServer();
startGatewayClient();

const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-XSS-Protection', '0');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	const sentryConnectSrc = __SENTRY_DSN__ ? ' *.sentry.io' : '';
	response.headers.set(
		'Content-Security-Policy',
		`default-src 'self' *.cloudflareaccess.com; script-src 'self' 'unsafe-inline' static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; connect-src 'self'${sentryConnectSrc}; img-src 'self' data:; font-src 'self' data:; worker-src 'self'; manifest-src 'self'`
	);

	return response;
};

export const handle = sequence(Sentry.sentryHandle(), securityHeaders);

export const handleError = Sentry.handleErrorWithSentry();
