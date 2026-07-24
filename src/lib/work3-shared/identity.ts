/**
 * Waiting-on classification shared by server aggregates and client focus filters.
 *
 * Work v3 intentionally stores `waiting_on` as a human-readable identity. Until
 * identities are normalized, agent and bot prefixes are the documented contract.
 */
export function isAgentIdentity(value: string | null | undefined): boolean {
	if (!value) return false;
	const normalized = value.trim().toLowerCase();
	return normalized.startsWith('agent') || normalized.startsWith('bot');
}
