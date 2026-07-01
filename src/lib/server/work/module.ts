export interface FalconDashModule {
	id: string;
	label: string;
	description: string;
	primary: boolean;
	status: 'active' | 'planned' | 'advanced';
	routes: string[];
	apiRoutes: string[];
	capabilities: string[];
}

export const FALCON_DASH_MODULES: FalconDashModule[] = [
	{
		id: 'shell',
		label: 'Shell',
		description: 'Falcon Dash app shell, readiness, and module mounting.',
		primary: true,
		status: 'active',
		routes: ['/'],
		apiRoutes: ['/api/falcon-dash/modules', '/api/health'],
		capabilities: ['navigation', 'operator dashboard shell', 'module registry']
	},
	{
		id: 'work',
		label: 'Work',
		description: 'Work Management: queue, schema, migration, context, and agent operations.',
		primary: true,
		status: 'active',
		routes: ['/work'],
		apiRoutes: ['/api/work', '/api/work/queue', '/api/work/items', '/api/work/context'],
		capabilities: [
			'work queue',
			'work items',
			'change requests',
			'open questions',
			'decisions',
			'automations',
			'findings',
			'generated context'
		]
	},
	{
		id: 'vault',
		label: 'Vault',
		description: 'KeePassXC-backed password vault and SecretRef operations.',
		primary: true,
		status: 'active',
		routes: ['/passwords', '/secrets'],
		apiRoutes: ['/api/vault/status', '/api/vault/entries', '/api/vault/groups'],
		capabilities: ['password vault', 'SecretRef resolution', 'credential inventory']
	},
	{
		id: 'channels',
		label: 'Channels',
		description: 'Channel onboarding, readiness, validation, and recovery.',
		primary: true,
		status: 'active',
		routes: ['/channels', '/channels/discord', '/channels/telegram'],
		apiRoutes: ['/api/gateway/rpc'],
		capabilities: ['channel onboarding', 'readiness checks', 'provider recovery']
	},
	{
		id: 'labs',
		label: 'Labs / Advanced',
		description: 'Legacy and advanced surfaces not promoted to the default operator workflow.',
		primary: false,
		status: 'advanced',
		routes: ['/documents', '/jobs', '/ops', '/skills', '/settings', '/approvals', '/heartbeat'],
		apiRoutes: ['/api/files-bulk', '/api/files/[...path]', '/api/ops/entries', '/api/ops/sessions'],
		capabilities: ['documents', 'agent jobs', 'settings', 'skills', 'advanced diagnostics']
	}
];

export function getFalconDashModules(): FalconDashModule[] {
	return FALCON_DASH_MODULES;
}
