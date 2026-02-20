const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatHourMin(hour: number, min: number): string {
	if (hour === 0 && min === 0) return 'midnight';
	if (hour === 12 && min === 0) return 'noon';
	const ampm = hour < 12 ? 'AM' : 'PM';
	const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
	return min === 0 ? `${h}:00 ${ampm}` : `${h}:${String(min).padStart(2, '0')} ${ampm}`;
}

export function describeCron(expr: string): string {
	if (typeof expr !== 'string') return String(expr);
	const parts = expr.trim().split(/\s+/);
	if (parts.length !== 5) return expr;
	const [min, hour, dom, mon, dow] = parts;

	if (expr === '* * * * *') return 'Every minute';

	// Every N minutes with hour/dow constraints
	if (min.startsWith('*/') && hour !== '*') {
		const interval = min.slice(2);
		const hourRange = hour.includes('-') ? hour.replace('-', 'AM\u2013') + 'PM' : hour;
		if (dow === '1-5')
			return `Every ${interval} min, ${hourRange.includes('\u2013') ? hourRange : formatHourMin(parseInt(hour), 0).replace(/:00 /, '')} weekdays`;
		return `Every ${interval} min`;
	}

	if (min.startsWith('*/')) return `Every ${min.slice(2)} min`;
	if (min === '0' && hour.startsWith('*/')) return `Every ${hour.slice(2)} hours`;

	// Specific time patterns
	if (min === '0' && hour !== '*' && !hour.includes('/')) {
		const h = parseInt(hour, 10);
		if (!isNaN(h)) {
			const timeStr = formatHourMin(h, 0);

			if (dom === '*' && mon === '*') {
				if (dow === '*') return `Daily at ${timeStr}`;
				if (dow === '1-5') return `Weekdays at ${timeStr}`;
				if (dow === '0,6' || dow === '6,0') return `Weekends at ${timeStr}`;
				const dayNum = parseInt(dow, 10);
				if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6)
					return `${DAY_NAMES[dayNum]}s at ${timeStr}`;
			}
		}
	}

	// Non-zero minute with specific hour
	if (!min.includes('*') && !min.includes('/') && hour !== '*' && !hour.includes('/')) {
		const m = parseInt(min, 10);
		const h = parseInt(hour, 10);
		if (!isNaN(m) && !isNaN(h)) {
			const timeStr = formatHourMin(h, m);
			if (dom === '*' && mon === '*') {
				if (dow === '*') return `Daily at ${timeStr}`;
				if (dow === '1-5') return `Weekdays at ${timeStr}`;
			}
		}
	}

	if (min === '0' && hour === '0' && dow === '0') return 'Weekly on Sunday';
	if (min === '0' && hour === '0' && dom === '1') return 'Monthly on the 1st';

	return expr;
}

export function shortTimezone(tz: string): string {
	try {
		const fmt = new Intl.DateTimeFormat('en-US', {
			timeZone: tz,
			timeZoneName: 'short'
		});
		const parts = fmt.formatToParts(new Date());
		const tzPart = parts.find((p) => p.type === 'timeZoneName');
		return tzPart?.value ?? tz;
	} catch {
		return tz;
	}
}

export function describeScheduleObject(raw: Record<string, unknown>): string {
	const kind = raw.kind as string | undefined;

	if (kind === 'cron' || typeof raw.expr === 'string') {
		const desc = describeCron(raw.expr as string);
		if (typeof raw.tz === 'string') {
			return `${desc} ${shortTimezone(raw.tz)}`;
		}
		return desc;
	}

	if (kind === 'every' || typeof raw.everyMs === 'number') {
		const ms = raw.everyMs as number;
		if (ms >= 86400000) {
			const d = Math.round(ms / 86400000);
			return d === 1 ? 'Every day' : `Every ${d} days`;
		}
		if (ms >= 3600000) {
			const h = Math.round(ms / 3600000);
			return h === 1 ? 'Every hour' : `Every ${h} hours`;
		}
		if (ms >= 60000) {
			const m = Math.round(ms / 60000);
			return m === 1 ? 'Every minute' : `Every ${m} min`;
		}
		return `Every ${ms / 1000}s`;
	}

	if (kind === 'at' || typeof raw.at === 'string') {
		try {
			const d = new Date(raw.at as string);
			return (
				d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
				' at ' +
				d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
			);
		} catch {
			return raw.at as string;
		}
	}

	return JSON.stringify(raw);
}

export const CRON_PRESETS = [
	{ label: 'Every minute', value: '* * * * *' },
	{ label: 'Every 5 minutes', value: '*/5 * * * *' },
	{ label: 'Every 15 minutes', value: '*/15 * * * *' },
	{ label: 'Every hour', value: '0 * * * *' },
	{ label: 'Every day at midnight', value: '0 0 * * *' },
	{ label: 'Every Monday at 9am', value: '0 9 * * 1' }
];
