import type { Metric } from 'web-vitals';

type VitalsReporter = (metric: Metric) => void;

const defaultReporter: VitalsReporter = (metric) => {
	// Log to console in development, could be sent to an analytics endpoint in production
	if (import.meta.env.DEV) {
		const color =
			metric.rating === 'good'
				? '#0cce6b'
				: metric.rating === 'needs-improvement'
					? '#ffa400'
					: '#ff4e42';
		console.log(
			`%c[Web Vitals] ${metric.name}: ${Math.round(metric.value)}ms (${metric.rating})`,
			`color: ${color}; font-weight: bold`
		);
	}
};

/**
 * Initialize Core Web Vitals measurement.
 * Dynamically imports web-vitals to avoid blocking the critical path.
 */
export async function measureWebVitals(reporter?: VitalsReporter): Promise<void> {
	const report = reporter ?? defaultReporter;
	const { onCLS, onINP, onLCP, onFCP, onTTFB } = await import('web-vitals');
	onCLS(report);
	onINP(report);
	onLCP(report);
	onFCP(report);
	onTTFB(report);
}
