import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	dsn: __SENTRY_DSN__,
	release: __APP_VERSION__,
	environment: __SENTRY_ENVIRONMENT__,
	enabled: !!__SENTRY_DSN__,
	tracesSampleRate: 0,
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 0
});

export const handleError = Sentry.handleErrorWithSentry();
