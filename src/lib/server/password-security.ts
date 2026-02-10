/**
 * Security utilities for the password manager.
 * Ensures secret values never leak to AI models, logs, or prompts.
 */

/**
 * Pattern matching vault path references like "vault://path/to/entry"
 */
export const SECRET_PATH_PATTERN = /vault:\/\/[a-zA-Z0-9/_-]+/g;

/**
 * Checks if text contains a vault path reference.
 */
export function isSecretReference(text: string): boolean {
	return SECRET_PATH_PATTERN.test(text);
}

/**
 * Sanitizes text before sending to AI models.
 * Strips any secret references to prevent accidental exposure.
 */
export function sanitizeForAI(text: string): string {
	// Remove vault path references
	let sanitized = text.replace(SECRET_PATH_PATTERN, '[SECRET_REFERENCE]');

	// Remove common password patterns (sequences that look like passwords)
	// Match: 8+ chars with mix of upper, lower, digits, special chars
	const passwordPattern =
		/\b(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{8,}\b/g;
	sanitized = sanitized.replace(passwordPattern, '[REDACTED_PASSWORD]');

	// Remove common secret keywords followed by values
	const secretKeywords =
		/\b(password|passwd|secret|api[_-]?key|token|auth[_-]?token|private[_-]?key)\s*[:=]\s*\S+/gi;
	sanitized = sanitized.replace(secretKeywords, (match) => {
		const colonIdx = Math.max(match.indexOf(':'), match.indexOf('='));
		return match.substring(0, colonIdx + 1) + ' [REDACTED]';
	});

	return sanitized;
}

/**
 * Masks secret values in log output.
 * Replaces potential secret values with [REDACTED] for safe logging.
 */
export function maskSecretInLog(text: string): string {
	// Mask vault references
	let masked = text.replace(SECRET_PATH_PATTERN, '[REDACTED:vault-path]');

	// Mask password-like strings (8+ chars with mixed case/digits/symbols)
	const passwordPattern =
		/\b(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{8,}\b/g;
	masked = masked.replace(passwordPattern, '[REDACTED:password]');

	// Mask JSON fields with sensitive keys
	const jsonSecretPattern =
		/"(password|passwd|secret|apiKey|api_key|token|authToken|auth_token|privateKey|private_key)"\s*:\s*"[^"]+"/gi;
	masked = masked.replace(jsonSecretPattern, (match) => {
		const keyMatch = match.match(/"([^"]+)"/);
		return keyMatch ? `"${keyMatch[1]}": "[REDACTED]"` : '[REDACTED:json-secret]';
	});

	// Mask Authorization headers
	masked = masked.replace(/authorization:\s*bearer\s+\S+/gi, 'authorization: Bearer [REDACTED]');
	masked = masked.replace(/x-session-token:\s*\S+/gi, 'x-session-token: [REDACTED]');

	return masked;
}
