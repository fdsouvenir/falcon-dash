import { DomainError, requireValue } from '../work/store.mjs';
// Endpoint constants are adapter-owned, never caller-controlled destinations.
async function request(fetcher, url, options) {
	const r = await fetcher(url, {
		...options,
		redirect: 'error',
		signal: AbortSignal.timeout(15000)
	});
	if (!r.ok)
		throw new DomainError(
			r.status === 403
				? 'scope_failure'
				: r.status === 401
					? 'reauthorization_required'
					: 'provider_unavailable',
			'Provider request failed'
		);
	return r.json();
}
export function adapters(fetcher = fetch) {
	return {
		highlevel: {
			async test(material, connection) {
				requireValue(
					connection.account_id,
					'input_required',
					'HighLevel validation requires a location id'
				);
				await request(
					fetcher,
					`https://services.leadconnectorhq.com/locations/${encodeURIComponent(connection.account_id)}`,
					{ headers: { Authorization: `Bearer ${material.access_token}`, Version: '2021-07-28' } }
				);
				return { health: 'healthy' };
			},
			async refresh(material) {
				const body = new URLSearchParams({
					grant_type: 'refresh_token',
					client_id: material.client_id,
					client_secret: material.client_secret,
					refresh_token: material.refresh_token
				});
				const out = await request(fetcher, 'https://services.leadconnectorhq.com/oauth/token', {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body
				});
				requireValue(
					typeof out.access_token === 'string' &&
						out.access_token.length &&
						Number.isFinite(out.expires_in),
					'provider_response_invalid',
					'Provider omitted token or expiry'
				);
				const next = { access_token: out.access_token };
				if (out.refresh_token) next.refresh_token = out.refresh_token;
				return {
					material: next,
					health: 'healthy',
					next_at: Date.now() + Math.max(60, out.expires_in - 300) * 1000
				};
			}
		},
		cloudflare: {
			async test(material) {
				const out = await request(
					fetcher,
					'https://api.cloudflare.com/client/v4/user/tokens/verify',
					{ headers: { Authorization: `Bearer ${material.api_token}` } }
				);
				requireValue(
					out.success && out.result?.status === 'active',
					'scope_failure',
					'Token is not active'
				);
				return { health: 'unavailable', validation: 'token_active_permissions_unverified' };
			},
			async refresh() {
				throw new DomainError(
					'unsupported_operation',
					'Static tokens must be explicitly rotated, not refreshed'
				);
			}
		}
	};
}
