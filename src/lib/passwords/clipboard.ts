let clearTimer: ReturnType<typeof setTimeout> | null = null;

export async function copyWithAutoClear(text: string, clearAfterMs = 30000): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
	} catch {
		const ta = document.createElement('textarea');
		ta.value = text;
		document.body.appendChild(ta);
		ta.select();
		document.execCommand('copy');
		document.body.removeChild(ta);
	}

	// Clear clipboard after timeout
	if (clearTimer) clearTimeout(clearTimer);
	clearTimer = setTimeout(async () => {
		try {
			await navigator.clipboard.writeText('');
		} catch {
			// Can't clear clipboard
		}
	}, clearAfterMs);
}
