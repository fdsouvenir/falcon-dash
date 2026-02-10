import { getDb } from './database.js';

// PM Error codes
export const PM_ERRORS = {
	PM_NOT_FOUND: 'PM_NOT_FOUND',
	PM_CONSTRAINT: 'PM_CONSTRAINT',
	PM_INVALID_PARENT: 'PM_INVALID_PARENT',
	PM_CIRCULAR_BLOCK: 'PM_CIRCULAR_BLOCK',
	PM_DUPLICATE: 'PM_DUPLICATE'
} as const;

export class PMError extends Error {
	code: string;
	constructor(code: string, message: string) {
		super(message);
		this.code = code;
		this.name = 'PMError';
	}
}

// Parse prefixed ID: "P-42" -> 42, "42" -> 42, 42 -> 42
export function parseId(id: string | number): number {
	if (typeof id === 'number') return id;
	const match = id.match(/^[A-Z]+-(\d+)$/);
	return match ? parseInt(match[1], 10) : parseInt(id, 10);
}

// Parse slug ID: accepts string as-is
export function parseSlugId(id: string): string {
	return id.trim();
}

// Pagination
export interface PaginationParams {
	cursor?: number;
	limit?: number;
}

export interface PaginatedResult<T> {
	items: T[];
	nextCursor: number | null;
	hasMore: boolean;
}

export function parsePagination(params?: { cursor?: number; limit?: number }): {
	cursor: number;
	limit: number;
} {
	const cursor = params?.cursor ?? 0;
	const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200);
	return { cursor, limit };
}

export function paginate<T extends { id: number }>(
	items: T[],
	cursor: number,
	limit: number
): PaginatedResult<T> {
	const filtered = cursor > 0 ? items.filter((i) => i.id > cursor) : items;
	const page = filtered.slice(0, limit);
	const hasMore = filtered.length > limit;
	const nextCursor = page.length > 0 ? page[page.length - 1].id : null;
	return { items: page, nextCursor, hasMore };
}

// Idempotency tracking (in-memory, keyed by idempotencyKey)
const idempotencyCache = new Map<string, { result: unknown; expiresAt: number }>();

export function checkIdempotency(key: string | undefined): unknown | null {
	if (!key) return null;
	const cached = idempotencyCache.get(key);
	if (cached && Date.now() < cached.expiresAt) return cached.result;
	if (cached) idempotencyCache.delete(key);
	return null;
}

export function cacheIdempotency(key: string, result: unknown): void {
	// Cache for 5 minutes
	idempotencyCache.set(key, { result, expiresAt: Date.now() + 5 * 60 * 1000 });
	// Cleanup old entries periodically
	if (idempotencyCache.size > 1000) {
		const now = Date.now();
		for (const [k, v] of idempotencyCache) {
			if (now > v.expiresAt) idempotencyCache.delete(k);
		}
	}
}

// Validation helpers
export function requireString(value: unknown, field: string): string {
	if (typeof value !== 'string' || !value.trim()) {
		throw new PMError(
			PM_ERRORS.PM_CONSTRAINT,
			`${field} is required and must be a non-empty string`
		);
	}
	return value.trim();
}

export function requireNumber(value: unknown, field: string): number {
	const num = typeof value === 'string' ? parseInt(value, 10) : value;
	if (typeof num !== 'number' || isNaN(num)) {
		throw new PMError(PM_ERRORS.PM_CONSTRAINT, `${field} is required and must be a number`);
	}
	return num;
}

export function optionalString(value: unknown): string | undefined {
	if (value == null || value === '') return undefined;
	if (typeof value !== 'string') return undefined;
	return value.trim();
}

export function optionalNumber(value: unknown): number | undefined {
	if (value == null) return undefined;
	const num = typeof value === 'string' ? parseInt(value as string, 10) : value;
	if (typeof num !== 'number' || isNaN(num)) return undefined;
	return num;
}

export function validateStatus(status: unknown): string {
	const valid = ['todo', 'in_progress', 'review', 'done', 'cancelled', 'archived'];
	if (typeof status !== 'string' || !valid.includes(status)) {
		throw new PMError(
			PM_ERRORS.PM_CONSTRAINT,
			`Invalid status. Must be one of: ${valid.join(', ')}`
		);
	}
	return status;
}

export function validatePriority(priority: unknown): string {
	const valid = ['low', 'normal', 'high', 'urgent'];
	if (typeof priority !== 'string' || !valid.includes(priority)) {
		throw new PMError(
			PM_ERRORS.PM_CONSTRAINT,
			`Invalid priority. Must be one of: ${valid.join(', ')}`
		);
	}
	return priority;
}

export function requireIdempotencyKey(params: Record<string, unknown>): string {
	const key = params.idempotencyKey;
	if (typeof key !== 'string' || !key.trim()) {
		throw new PMError(
			PM_ERRORS.PM_CONSTRAINT,
			'idempotencyKey is required for mutating operations'
		);
	}
	return key.trim();
}

// Validate that a block wouldn't create a cycle
export function validateBlockNoCycle(
	blockerId: number,
	blockedId: number,
	existingBlocks: { blocker_id: number; blocked_id: number }[]
): void {
	if (blockerId === blockedId) {
		throw new PMError(PM_ERRORS.PM_CIRCULAR_BLOCK, 'A task cannot block itself');
	}
	// Check if blockedId already (transitively) blocks blockerId
	const visited = new Set<number>();
	const queue = [blockedId];
	while (queue.length > 0) {
		const current = queue.pop()!;
		if (current === blockerId) {
			throw new PMError(PM_ERRORS.PM_CIRCULAR_BLOCK, 'This would create a circular dependency');
		}
		if (visited.has(current)) continue;
		visited.add(current);
		for (const b of existingBlocks) {
			if (b.blocked_id === current) queue.push(b.blocker_id);
		}
	}
}

// Validate entity exists
export function validateDomainExists(id: string): void {
	const db = getDb();
	const result = db.prepare('SELECT id FROM domains WHERE id = ?').get(id);
	if (!result) {
		throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Domain with id "${id}" not found`);
	}
}

export function validateFocusExists(id: string): void {
	const db = getDb();
	const result = db.prepare('SELECT id FROM focuses WHERE id = ?').get(id);
	if (!result) {
		throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Focus with id "${id}" not found`);
	}
}

export function validateMilestoneExists(id: number): void {
	const db = getDb();
	const result = db.prepare('SELECT id FROM milestones WHERE id = ?').get(id);
	if (!result) {
		throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Milestone with id ${id} not found`);
	}
}

export function validateProjectExists(id: number): void {
	const db = getDb();
	const result = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
	if (!result) {
		throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Project with id ${id} not found`);
	}
}

export function validateTaskExists(id: number): void {
	const db = getDb();
	const result = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
	if (!result) {
		throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Task with id ${id} not found`);
	}
}

export function validateCommentExists(id: number): void {
	const db = getDb();
	const result = db.prepare('SELECT id FROM comments WHERE id = ?').get(id);
	if (!result) {
		throw new PMError(PM_ERRORS.PM_NOT_FOUND, `Comment with id ${id} not found`);
	}
}

// Validate parent relationships
export function validateTaskParent(params: {
	parent_project_id?: number;
	parent_task_id?: number;
}): void {
	if (!params.parent_project_id && !params.parent_task_id) {
		throw new PMError(
			PM_ERRORS.PM_INVALID_PARENT,
			'Task must have either parent_project_id or parent_task_id'
		);
	}
	if (params.parent_project_id && params.parent_task_id) {
		throw new PMError(
			PM_ERRORS.PM_INVALID_PARENT,
			'Task cannot have both parent_project_id and parent_task_id'
		);
	}
	if (params.parent_project_id) {
		validateProjectExists(params.parent_project_id);
	}
	if (params.parent_task_id) {
		validateTaskExists(params.parent_task_id);
	}
}

// Validate target type
export function validateTargetType(targetType: unknown): string {
	const valid = ['project', 'task'];
	if (typeof targetType !== 'string' || !valid.includes(targetType)) {
		throw new PMError(
			PM_ERRORS.PM_CONSTRAINT,
			`Invalid target_type. Must be one of: ${valid.join(', ')}`
		);
	}
	return targetType;
}

// Validate date format (ISO 8601 date: YYYY-MM-DD)
export function validateDateFormat(date: string): void {
	const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
	if (!dateRegex.test(date)) {
		throw new PMError(
			PM_ERRORS.PM_CONSTRAINT,
			'Invalid date format. Must be ISO 8601 date (YYYY-MM-DD)'
		);
	}
}

// Validate duplicate domain/focus ID
export function validateDomainIdUnique(id: string): void {
	const db = getDb();
	const result = db.prepare('SELECT id FROM domains WHERE id = ?').get(id);
	if (result) {
		throw new PMError(PM_ERRORS.PM_DUPLICATE, `Domain with id "${id}" already exists`);
	}
}

export function validateFocusIdUnique(id: string): void {
	const db = getDb();
	const result = db.prepare('SELECT id FROM focuses WHERE id = ?').get(id);
	if (result) {
		throw new PMError(PM_ERRORS.PM_DUPLICATE, `Focus with id "${id}" already exists`);
	}
}

// Validate block doesn't already exist
export function validateBlockUnique(blockerId: number, blockedId: number): void {
	const db = getDb();
	const result = db
		.prepare('SELECT * FROM blocks WHERE blocker_id = ? AND blocked_id = ?')
		.get(blockerId, blockedId);
	if (result) {
		throw new PMError(PM_ERRORS.PM_DUPLICATE, 'This block relationship already exists');
	}
}
