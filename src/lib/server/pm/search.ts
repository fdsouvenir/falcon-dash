import { getDb } from './database.js';

/**
 * Search result interface
 */
export interface SearchResult {
	entity_type: string;
	entity_id: number;
	project_id: number;
	title: string;
	snippet: string;
	rank: number;
}

/**
 * Search options
 */
export interface SearchOptions {
	entityType?: string;
	projectId?: number;
	limit?: number;
	offset?: number;
}

/**
 * Search PM entities using FTS5
 */
export function searchPM(query: string, options?: SearchOptions): SearchResult[] {
	const db = getDb();
	const limit = options?.limit ?? 20;
	const offset = options?.offset ?? 0;

	let sql = `
		SELECT
			entity_type,
			CAST(entity_id AS INTEGER) as entity_id,
			CAST(project_id AS INTEGER) as project_id,
			title,
			snippet(pm_search, 4, '<mark>', '</mark>', '...', 32) as snippet,
			rank
		FROM pm_search
		WHERE pm_search MATCH ?
	`;
	const params: (string | number)[] = [query];

	if (options?.entityType) {
		sql += ` AND entity_type = ?`;
		params.push(options.entityType);
	}
	if (options?.projectId) {
		sql += ` AND project_id = ?`;
		params.push(options.projectId);
	}

	sql += ` ORDER BY rank LIMIT ? OFFSET ?`;
	params.push(limit, offset);

	return db.prepare(sql).all(...params) as SearchResult[];
}

/**
 * Rebuild search index from existing data
 */
export function rebuildSearchIndex(): void {
	const db = getDb();

	db.exec(`DELETE FROM pm_search`);

	// Re-index projects (title + description + body)
	db.exec(`
		INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
		SELECT 'project', id, id, title, COALESCE(description, '') || ' ' || COALESCE(body, '')
		FROM projects;
	`);
}
