let overrideUrl: string | undefined;

export function setBaseUrl(url: string): void {
	overrideUrl = url;
}

export function getBaseUrl(): string {
	return overrideUrl ?? process.env.FALCON_DASH_URL ?? 'http://localhost:5173/api/pm';
}
