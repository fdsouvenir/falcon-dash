import { TYPES, TASK_STATES } from './work/store.mjs';
export const workCommands = [
	'create',
	'ready',
	'unready',
	'start',
	'wait',
	'resume',
	'complete',
	'reopen',
	'abandon',
	'assign',
	'revise_definition',
	'revise_plan',
	'checkpoint',
	'revise_change',
	'depends_on',
	'associate',
	'achieve'
];
export const tools = {
	falcon_work: {
		description:
			'Read bounded canonical Work or execute an explicit versioned semantic command. Dependencies warn; Milestone closure guards enforce domain consistency, not runtime permissions.',
		parameters: {
			type: 'object',
			additionalProperties: false,
			required: ['action'],
			properties: {
				action: { type: 'string', enum: ['list', 'get', 'command'] },
				id: { type: 'string' },
				full: { type: 'boolean' },
				query: {
					type: 'object',
					additionalProperties: false,
					properties: {
						type: { type: 'string', enum: TYPES },
						limit: { type: 'integer', minimum: 1, maximum: 100 },
						offset: { type: 'integer', minimum: 0 },
						agent_id: { type: 'string' },
						search: { type: 'string' }
					}
				},
				request: {
					type: 'object',
					additionalProperties: false,
					required: ['command', 'idempotency_key', 'input'],
					properties: {
						command: { type: 'string', enum: workCommands },
						id: { type: 'string' },
						expected_version: { type: 'integer' },
						idempotency_key: { type: 'string', maxLength: 128 },
						input: { type: 'object' }
					}
				}
			}
		}
	},
	falcon_integrations: {
		description:
			'Read redacted connection health or request deterministic validation/maintenance. Native-owned credentials have no Falcon refresh path.',
		parameters: {
			type: 'object',
			additionalProperties: false,
			required: ['action'],
			properties: {
				action: { type: 'string', enum: ['list', 'test', 'refresh', 'pause', 'resume'] },
				id: { type: 'string' }
			}
		}
	},
	falcon_documents: {
		description:
			'Read or edit explicitly authorized text workspaces. Credential paths and symlinks are unavailable. Writes require the exact read version; creation uses null.',
		parameters: {
			type: 'object',
			additionalProperties: false,
			required: ['action', 'root_id'],
			properties: {
				action: { type: 'string', enum: ['list', 'read', 'write', 'mkdir'] },
				root_id: { type: 'string' },
				path: { type: 'string' },
				content: { type: 'string', maxLength: 262144 },
				expected_version: { type: ['string', 'null'] },
				search: { type: 'string' }
			}
		}
	},
	falcon_vault: {
		description:
			'Read opaque Vault inventory and lock state only. Credential creation/reveal/resolution are never general tool operations.',
		parameters: {
			type: 'object',
			additionalProperties: false,
			required: ['action'],
			properties: { action: { type: 'string', enum: ['status', 'inventory'] } }
		}
	}
};
export function buildContract(enabled) {
	return JSON.stringify({
		plugin: 'falcon-dash',
		version: '4.0.0-alpha.0',
		...(enabled.includes('work') ? { work: { types: TYPES, task_states: TASK_STATES } } : {}),
		operations: Object.fromEntries(
			Object.entries(tools).filter(([name]) => enabled.includes(name.slice(7)))
		),
		ownership: {
			runtime: 'OpenClaw',
			work: 'Falcon Dash',
			credentials: 'KeePassXC; opaque handles in ordinary payloads'
		},
		ui: {
			mode: 'sandboxed read-only preview',
			writes: 'Unavailable pending authenticated iframe bridge decision'
		}
	});
}
