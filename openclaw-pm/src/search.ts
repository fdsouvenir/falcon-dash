import { getDb } from './database.js';

/**
 * Initialize FTS5 search tables and triggers
 */
export function initSearch(): void {
	const db = getDb();

	// Create FTS5 virtual table
	db.exec(`
		CREATE VIRTUAL TABLE IF NOT EXISTS pm_search USING fts5(
			entity_type,
			entity_id UNINDEXED,
			project_id UNINDEXED,
			title,
			body,
			tokenize='porter unicode61'
		);
	`);

	// Triggers for projects
	db.exec(`
		CREATE TRIGGER IF NOT EXISTS trg_projects_insert AFTER INSERT ON projects BEGIN
			INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
			VALUES ('project', NEW.id, NEW.id, NEW.title, COALESCE(NEW.description, ''));
		END;

		CREATE TRIGGER IF NOT EXISTS trg_projects_update AFTER UPDATE ON projects BEGIN
			DELETE FROM pm_search WHERE entity_type = 'project' AND entity_id = OLD.id;
			INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
			VALUES ('project', NEW.id, NEW.id, NEW.title, COALESCE(NEW.description, ''));
		END;

		CREATE TRIGGER IF NOT EXISTS trg_projects_delete AFTER DELETE ON projects BEGIN
			DELETE FROM pm_search WHERE entity_type = 'project' AND entity_id = OLD.id;
		END;
	`);

	// Triggers for tasks
	db.exec(`
		CREATE TRIGGER IF NOT EXISTS trg_tasks_insert AFTER INSERT ON tasks BEGIN
			INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
			VALUES ('task', NEW.id, COALESCE(NEW.parent_project_id, 0), NEW.title, COALESCE(NEW.body, ''));
		END;

		CREATE TRIGGER IF NOT EXISTS trg_tasks_update AFTER UPDATE ON tasks BEGIN
			DELETE FROM pm_search WHERE entity_type = 'task' AND entity_id = OLD.id;
			INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
			VALUES ('task', NEW.id, COALESCE(NEW.parent_project_id, 0), NEW.title, COALESCE(NEW.body, ''));
		END;

		CREATE TRIGGER IF NOT EXISTS trg_tasks_delete AFTER DELETE ON tasks BEGIN
			DELETE FROM pm_search WHERE entity_type = 'task' AND entity_id = OLD.id;
		END;
	`);

	// Triggers for comments
	db.exec(`
		CREATE TRIGGER IF NOT EXISTS trg_comments_insert AFTER INSERT ON comments BEGIN
			INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
			VALUES ('comment', NEW.id, 0, '', NEW.body);
		END;

		CREATE TRIGGER IF NOT EXISTS trg_comments_update AFTER UPDATE ON comments BEGIN
			DELETE FROM pm_search WHERE entity_type = 'comment' AND entity_id = OLD.id;
			INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
			VALUES ('comment', NEW.id, 0, '', NEW.body);
		END;

		CREATE TRIGGER IF NOT EXISTS trg_comments_delete AFTER DELETE ON comments BEGIN
			DELETE FROM pm_search WHERE entity_type = 'comment' AND entity_id = OLD.id;
		END;
	`);
}

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

	// Re-index projects
	db.exec(`
		INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
		SELECT 'project', id, id, title, COALESCE(description, '')
		FROM projects;
	`);

	// Re-index tasks
	db.exec(`
		INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
		SELECT 'task', id, COALESCE(parent_project_id, 0), title, COALESCE(body, '')
		FROM tasks;
	`);

	// Re-index comments
	db.exec(`
		INSERT INTO pm_search(entity_type, entity_id, project_id, title, body)
		SELECT 'comment', id, 0, '', body
		FROM comments;
	`);
}
