export interface SettingsNavItem {
	id: string;
	title: string;
	subtitle: string;
	iconPath: string;
}

export interface SettingsNavGroup {
	label: string;
	items: SettingsNavItem[];
}

export const settingsNavGroups: SettingsNavGroup[] = [
	{
		label: 'CONFIGURE',
		items: [
			{
				id: 'user',
				title: 'User',
				subtitle: 'Your profile',
				iconPath: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z'
			},
			{
				id: 'agents',
				title: 'Agents',
				subtitle: 'System instructions',
				iconPath:
					'M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6'
			},
			{
				id: 'agent-files',
				title: 'Agent Files',
				subtitle: 'Instructions for your Agents',
				iconPath:
					'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
			},
			{
				id: 'skills',
				title: 'Skills',
				subtitle: 'Install capabilities and expertise',
				iconPath:
					'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z'
			},
			{
				id: 'tools',
				title: 'Tools',
				subtitle: 'Approval policies',
				iconPath:
					'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z'
			},
			{
				id: 'channels',
				title: 'Channels',
				subtitle: 'Discord, WhatsApp, Telegram',
				iconPath:
					'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z'
			},
			{
				id: 'dashboard',
				title: 'Dashboard',
				subtitle: 'Falcon Dash settings',
				iconPath:
					'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z'
			}
		]
	},
	{
		label: 'MONITOR',
		items: [
			{
				id: 'analytics',
				title: 'AI Usage',
				subtitle: 'Tokens and costs',
				iconPath:
					'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
			},
			{
				id: 'logs',
				title: 'Logs',
				subtitle: 'Live event stream',
				iconPath: 'M4 6h16M4 10h16M4 14h16M4 18h16'
			}
		]
	},
	{
		label: 'ADVANCED',
		items: [
			{
				id: 'api-keys',
				title: 'API Keys',
				subtitle: 'AI providers',
				iconPath:
					'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z'
			},
			{
				id: 'advanced',
				title: 'Gateway',
				subtitle: 'Status, config, connections',
				iconPath:
					'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z'
			}
		]
	},
	{
		label: 'ACCOUNT',
		items: [
			{
				id: 'subscription',
				title: 'Subscription',
				subtitle: 'Plan and billing',
				iconPath:
					'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'
			},
			{
				id: 'logout',
				title: 'Log Out',
				subtitle: 'End Cloudflare Access session',
				iconPath:
					'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
			}
		]
	}
];
