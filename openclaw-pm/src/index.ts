import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { getDb } from './database.js';
import { initSearch } from './search.js';
import { registerAllMethods } from './methods.js';

type OpenClawPluginDefinition = {
	id?: string;
	name?: string;
	description?: string;
	version?: string;
	activate?: (api: OpenClawPluginApi) => void | Promise<void>;
};

const plugin: OpenClawPluginDefinition = {
	id: 'openclaw-pm',
	name: 'OpenClaw Project Management',
	description:
		'Full-featured project management system with domains, focuses, projects, tasks, and AI context generation',
	version: '0.1.0',

	activate(api) {
		api.logger.info('Initializing OpenClaw PM plugin...');

		// Initialize database and schema (getDb() creates DB + schema on first call)
		getDb();
		api.logger.info('Database initialized');

		// Initialize search tables
		initSearch();
		api.logger.info('Search index initialized');

		// Register all 44 gateway methods
		registerAllMethods(api);
		api.logger.info('Registered 44 pm.* gateway methods');

		api.logger.info('OpenClaw PM plugin activated successfully');
	}
};

export default plugin;
