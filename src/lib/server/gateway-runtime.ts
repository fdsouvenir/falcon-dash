import { env } from '$env/dynamic/private';

export const GATEWAY_DISABLED_MESSAGE = 'Falcon Dash gateway client disabled by configuration';

export function isGatewayClientEnabled(): boolean {
	const value = (
		process.env.FALCON_DASH_GATEWAY_ENABLED ??
		env.FALCON_DASH_GATEWAY_ENABLED ??
		'true'
	)
		.trim()
		.toLowerCase();

	return !['0', 'false', 'off', 'no', 'disabled'].includes(value);
}
