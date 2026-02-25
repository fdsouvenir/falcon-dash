import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { registerFalconDashChannel } from './channel.js';
import { registerCanvasBridge } from './canvas-bridge.js';

type OpenClawPluginDefinition = {
	id?: string;
	name?: string;
	description?: string;
	version?: string;
	activate?: (api: OpenClawPluginApi) => void | Promise<void>;
};

const plugin: OpenClawPluginDefinition = {
	id: 'falcon-dash',
	name: 'Falcon Dashboard',
	description: 'Channel plugin and canvas operator bridge for Falcon Dash',
	version: '0.2.0',

	activate(api) {
		registerFalconDashChannel(api);
		registerCanvasBridge(api);
		api.logger.info('Falcon Dashboard plugin activated');
	}
};

export default plugin;
