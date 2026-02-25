import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { registerFalconDashChannel } from './channel.js';
import { registerCanvasBridge } from './canvas-bridge.js';
import { buildContext } from './context.js';

type OpenClawPluginDefinition = {
	id?: string;
	name?: string;
	description?: string;
	version?: string;
	activate?: (api: OpenClawPluginApi) => void | Promise<void>;
};

const plugin: OpenClawPluginDefinition = {
	id: 'falcon-dash-plugin',
	name: 'Falcon Dashboard',
	description: 'Channel plugin and canvas operator bridge for Falcon Dash',
	version: '0.2.0',

	activate(api) {
		registerFalconDashChannel(api);
		registerCanvasBridge(api);

		api.on('before_prompt_build', (_event, ctx) => {
			return {
				prependContext: buildContext(api, ctx.agentId)
			};
		});

		api.logger.info('Falcon Dashboard plugin activated');
	}
};

export default plugin;
