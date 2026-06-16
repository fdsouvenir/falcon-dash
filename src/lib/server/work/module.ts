export interface FalconDashModule {
	id: string;
	label: string;
	description: string;
	primary: boolean;
	routes: string[];
}

export const FALCON_DASH_MODULES: FalconDashModule[] = [
	{
		id: 'shell',
		label: 'Shell',
		description: 'Falcon Dash app shell, readiness, and module mounting.',
		primary: true,
		routes: ['/']
	},
	{
		id: 'work',
		label: 'Work',
		description: 'Work Management: queue, schema, migration, context, and agent operations.',
		primary: true,
		routes: ['/work', '/api/work']
	},
	{
		id: 'vault',
		label: 'Vault',
		description: 'KeePassXC-backed password vault and SecretRef operations.',
		primary: true,
		routes: ['/passwords', '/api/vault']
	},
	{
		id: 'channels',
		label: 'Channels',
		description: 'Channel onboarding, readiness, validation, and recovery.',
		primary: true,
		routes: ['/channels']
	},
	{
		id: 'labs',
		label: 'Labs / Advanced',
		description: 'Legacy and advanced surfaces not promoted to the default operator workflow.',
		primary: false,
		routes: ['/documents', '/jobs', '/ops', '/skills']
	}
];

export function getFalconDashModules(): FalconDashModule[] {
	return FALCON_DASH_MODULES;
}
