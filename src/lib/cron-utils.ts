export function describeCron(expr: string): string {
	const parts = expr.trim().split(/\s+/);
	if (parts.length !== 5) return expr;
	const [min, hour, dom, mon, dow] = parts;

	// Common patterns
	if (expr === '* * * * *') return 'Every minute';
	if (min.startsWith('*/')) return `Every ${min.slice(2)} minutes`;
	if (min === '0' && hour.startsWith('*/')) return `Every ${hour.slice(2)} hours`;
	if (min === '0' && hour === '0' && dom === '*' && mon === '*' && dow === '*')
		return 'Daily at midnight';
	if (min === '0' && hour === '*') return 'Every hour';
	if (min === '0' && hour !== '*' && dom === '*' && mon === '*' && dow === '*')
		return `Daily at ${hour}:00`;
	if (min === '0' && hour === '0' && dow === '0') return 'Weekly on Sunday';
	if (min === '0' && hour === '0' && dom === '1') return 'Monthly on the 1st';

	return expr;
}

export const CRON_PRESETS = [
	{ label: 'Every minute', value: '* * * * *' },
	{ label: 'Every 5 minutes', value: '*/5 * * * *' },
	{ label: 'Every 15 minutes', value: '*/15 * * * *' },
	{ label: 'Every hour', value: '0 * * * *' },
	{ label: 'Every day at midnight', value: '0 0 * * *' },
	{ label: 'Every Monday at 9am', value: '0 9 * * 1' }
];
