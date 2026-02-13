import type { OpenClawPluginApi, GatewayRequestHandlerOptions } from 'openclaw/plugin-sdk';
import {
	listDomains,
	getDomain,
	createDomain,
	updateDomain,
	deleteDomain,
	reorderDomains,
	listFocuses,
	getFocus,
	createFocus,
	updateFocus,
	deleteFocus,
	reorderFocuses,
	moveFocus,
	listMilestones,
	getMilestone,
	createMilestone,
	updateMilestone,
	deleteMilestone,
	listProjects,
	getProject,
	createProject,
	updateProject,
	deleteProject,
	listTasks,
	getTask,
	createTask,
	updateTask,
	deleteTask,
	moveTask,
	reorderTasks,
	listComments,
	createComment,
	deleteComment,
	listBlocks,
	createBlock,
	deleteBlock,
	listActivities,
	listAttachments,
	createAttachment,
	deleteAttachment
} from './crud.js';
import {
	PMError,
	validateBlockUnique,
	validateBlockNoCycle,
	validateTaskExists
} from './validation.js';
import { searchPM } from './search.js';
import { getPMStats } from './stats.js';
import {
	generateDashboardContext,
	generateDomainContext,
	generateProjectContext
} from './context.js';
import { bulkUpdate, bulkMove } from './bulk.js';
import { emitPMEvent, getStateVersion } from './events.js';
import { getDb } from './database.js';

export function registerAllMethods(api: OpenClawPluginApi): void {
	// ============================================================================
	// DOMAINS (6)
	// ============================================================================

	api.registerGatewayMethod('pm.domain.list', async ({ respond }: GatewayRequestHandlerOptions) => {
		try {
			const domains = listDomains();
			respond(true, { domains });
		} catch (err) {
			if (err instanceof PMError) {
				respond(false, undefined, { code: err.code, message: err.message });
			} else {
				respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
			}
		}
	});

	api.registerGatewayMethod(
		'pm.domain.get',
		async ({ params, respond }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: string };
				const domain = getDomain(p.id);
				if (!domain) {
					respond(false, undefined, {
						code: 'PM_NOT_FOUND',
						message: `Domain "${p.id}" not found`
					});
				} else {
					respond(true, domain);
				}
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.domain.create',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: string; name: string; description?: string };
				const domain = createDomain({ id: p.id, name: p.name, description: p.description });

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'created',
					entityType: 'domain',
					entityId: domain.id,
					actor,
					data: domain as unknown as Record<string, unknown>
				});
				context.broadcast('event:pm', event);

				respond(true, domain);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.domain.update',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: string; name?: string; description?: string };
				const domain = updateDomain(p.id, { name: p.name, description: p.description });

				if (!domain) {
					respond(false, undefined, {
						code: 'PM_NOT_FOUND',
						message: `Domain "${p.id}" not found`
					});
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'updated',
					entityType: 'domain',
					entityId: domain.id,
					actor,
					data: domain as unknown as Record<string, unknown>
				});
				context.broadcast('event:pm', event);

				respond(true, domain);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.domain.delete',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: string };
				const success = deleteDomain(p.id);

				if (!success) {
					respond(false, undefined, {
						code: 'PM_NOT_FOUND',
						message: `Domain "${p.id}" not found`
					});
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'deleted',
					entityType: 'domain',
					entityId: p.id,
					actor,
					data: { id: p.id }
				});
				context.broadcast('event:pm', event);

				respond(true, { success: true });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.domain.reorder',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { ids: string[] };
				reorderDomains(p.ids);

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'reordered',
					entityType: 'domain',
					entityId: 'bulk',
					actor,
					data: { ids: p.ids }
				});
				context.broadcast('event:pm', event);

				respond(true, { success: true });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	// ============================================================================
	// FOCUSES (7)
	// ============================================================================

	api.registerGatewayMethod(
		'pm.focus.list',
		async ({ params, respond }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { domainId?: string };
				const focuses = listFocuses(p.domainId);
				respond(true, { focuses });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.focus.get',
		async ({ params, respond }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: string };
				const focus = getFocus(p.id);
				if (!focus) {
					respond(false, undefined, { code: 'PM_NOT_FOUND', message: `Focus "${p.id}" not found` });
				} else {
					respond(true, focus);
				}
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.focus.create',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: string; domain_id: string; name: string; description?: string };
				const focus = createFocus({
					id: p.id,
					domain_id: p.domain_id,
					name: p.name,
					description: p.description
				});

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'created',
					entityType: 'focus',
					entityId: focus.id,
					actor,
					data: focus as unknown as Record<string, unknown>
				});
				context.broadcast('event:pm', event);

				respond(true, focus);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.focus.update',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: string; name?: string; description?: string };
				const focus = updateFocus(p.id, { name: p.name, description: p.description });

				if (!focus) {
					respond(false, undefined, { code: 'PM_NOT_FOUND', message: `Focus "${p.id}" not found` });
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'updated',
					entityType: 'focus',
					entityId: focus.id,
					actor,
					data: focus as unknown as Record<string, unknown>
				});
				context.broadcast('event:pm', event);

				respond(true, focus);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.focus.move',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: string; domainId: string };
				const focus = moveFocus(p.id, p.domainId);

				if (!focus) {
					respond(false, undefined, { code: 'PM_NOT_FOUND', message: `Focus "${p.id}" not found` });
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'moved',
					entityType: 'focus',
					entityId: focus.id,
					actor,
					data: focus as unknown as Record<string, unknown>
				});
				context.broadcast('event:pm', event);

				respond(true, focus);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.focus.delete',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: string };
				const success = deleteFocus(p.id);

				if (!success) {
					respond(false, undefined, { code: 'PM_NOT_FOUND', message: `Focus "${p.id}" not found` });
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'deleted',
					entityType: 'focus',
					entityId: p.id,
					actor,
					data: { id: p.id }
				});
				context.broadcast('event:pm', event);

				respond(true, { success: true });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.focus.reorder',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { ids: string[] };
				reorderFocuses(p.ids);

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'reordered',
					entityType: 'focus',
					entityId: 'bulk',
					actor,
					data: { ids: p.ids }
				});
				context.broadcast('event:pm', event);

				respond(true, { success: true });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	// ============================================================================
	// MILESTONES (5)
	// ============================================================================

	api.registerGatewayMethod(
		'pm.milestone.list',
		async ({ respond }: GatewayRequestHandlerOptions) => {
			try {
				const milestones = listMilestones();
				respond(true, { milestones });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.milestone.get',
		async ({ params, respond }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: number };
				const milestone = getMilestone(p.id);
				if (!milestone) {
					respond(false, undefined, {
						code: 'PM_NOT_FOUND',
						message: `Milestone ${p.id} not found`
					});
				} else {
					respond(true, milestone);
				}
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.milestone.create',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { name: string; due_date?: string; description?: string };
				const milestone = createMilestone({
					name: p.name,
					due_date: p.due_date,
					description: p.description
				});

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'created',
					entityType: 'milestone',
					entityId: milestone.id,
					actor,
					data: milestone as unknown as Record<string, unknown>
				});
				context.broadcast('event:pm', event);

				respond(true, milestone);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.milestone.update',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: number; name?: string; due_date?: string; description?: string };
				const milestone = updateMilestone(p.id, {
					name: p.name,
					due_date: p.due_date,
					description: p.description
				});

				if (!milestone) {
					respond(false, undefined, {
						code: 'PM_NOT_FOUND',
						message: `Milestone ${p.id} not found`
					});
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'updated',
					entityType: 'milestone',
					entityId: milestone.id,
					actor,
					data: milestone as unknown as Record<string, unknown>
				});
				context.broadcast('event:pm', event);

				respond(true, milestone);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.milestone.delete',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: number };
				const success = deleteMilestone(p.id);

				if (!success) {
					respond(false, undefined, {
						code: 'PM_NOT_FOUND',
						message: `Milestone ${p.id} not found`
					});
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'deleted',
					entityType: 'milestone',
					entityId: p.id,
					actor,
					data: { id: p.id }
				});
				context.broadcast('event:pm', event);

				respond(true, { success: true });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	// ============================================================================
	// PROJECTS (5)
	// ============================================================================

	api.registerGatewayMethod(
		'pm.project.list',
		async ({ params, respond }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { focus_id?: string; status?: string; milestone_id?: number };
				const projects = listProjects({
					focus_id: p.focus_id,
					status: p.status,
					milestone_id: p.milestone_id
				});
				respond(true, { projects });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.project.get',
		async ({ params, respond }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: number };
				const project = getProject(p.id);
				if (!project) {
					respond(false, undefined, { code: 'PM_NOT_FOUND', message: `Project ${p.id} not found` });
				} else {
					respond(true, project);
				}
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.project.create',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as {
					focus_id: string;
					title: string;
					description?: string;
					status?: string;
					milestone_id?: number;
					due_date?: string;
					priority?: string;
				};
				const project = createProject({
					focus_id: p.focus_id,
					title: p.title,
					description: p.description,
					status: p.status,
					milestone_id: p.milestone_id,
					due_date: p.due_date,
					priority: p.priority
				});

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'created',
					entityType: 'project',
					entityId: project.id,
					projectId: project.id,
					actor,
					data: project as unknown as Record<string, unknown>
				});
				context.broadcast('event:pm', event);

				respond(true, project);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.project.update',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as {
					id: number;
					title?: string;
					description?: string;
					status?: string;
					milestone_id?: number;
					due_date?: string;
					priority?: string;
					focus_id?: string;
				};
				const project = updateProject(p.id, {
					title: p.title,
					description: p.description,
					status: p.status,
					milestone_id: p.milestone_id,
					due_date: p.due_date,
					priority: p.priority,
					focus_id: p.focus_id
				});

				if (!project) {
					respond(false, undefined, { code: 'PM_NOT_FOUND', message: `Project ${p.id} not found` });
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'updated',
					entityType: 'project',
					entityId: project.id,
					projectId: project.id,
					actor,
					data: project as unknown as Record<string, unknown>
				});
				context.broadcast('event:pm', event);

				respond(true, project);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.project.delete',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: number };
				const success = deleteProject(p.id);

				if (!success) {
					respond(false, undefined, { code: 'PM_NOT_FOUND', message: `Project ${p.id} not found` });
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'deleted',
					entityType: 'project',
					entityId: p.id,
					projectId: p.id,
					actor,
					data: { id: p.id }
				});
				context.broadcast('event:pm', event);

				respond(true, { success: true });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	// ============================================================================
	// TASKS (7)
	// ============================================================================

	api.registerGatewayMethod(
		'pm.task.list',
		async ({ params, respond }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as {
					parent_project_id?: number;
					parent_task_id?: number;
					status?: string;
				};
				const tasks = listTasks({
					parent_project_id: p.parent_project_id,
					parent_task_id: p.parent_task_id,
					status: p.status
				});
				respond(true, { tasks });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.task.get',
		async ({ params, respond }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: number };
				const task = getTask(p.id);
				if (!task) {
					respond(false, undefined, { code: 'PM_NOT_FOUND', message: `Task ${p.id} not found` });
				} else {
					respond(true, task);
				}
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.task.create',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as {
					title: string;
					body?: string;
					parent_project_id?: number;
					parent_task_id?: number;
					status?: string;
					due_date?: string;
					priority?: string;
					milestone_id?: number;
				};
				const task = createTask({
					title: p.title,
					body: p.body,
					parent_project_id: p.parent_project_id,
					parent_task_id: p.parent_task_id,
					status: p.status,
					due_date: p.due_date,
					priority: p.priority,
					milestone_id: p.milestone_id
				});

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'created',
					entityType: 'task',
					entityId: task.id,
					projectId: task.parent_project_id,
					actor,
					data: task as unknown as Record<string, unknown>
				});
				context.broadcast('event:pm', event);

				respond(true, task);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.task.update',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as {
					id: number;
					title?: string;
					body?: string;
					status?: string;
					due_date?: string;
					priority?: string;
					milestone_id?: number;
				};
				const task = updateTask(p.id, {
					title: p.title,
					body: p.body,
					status: p.status,
					due_date: p.due_date,
					priority: p.priority,
					milestone_id: p.milestone_id
				});

				if (!task) {
					respond(false, undefined, { code: 'PM_NOT_FOUND', message: `Task ${p.id} not found` });
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'updated',
					entityType: 'task',
					entityId: task.id,
					projectId: task.parent_project_id,
					actor,
					data: task as unknown as Record<string, unknown>
				});
				context.broadcast('event:pm', event);

				respond(true, task);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.task.move',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: number; parent_project_id?: number; parent_task_id?: number };
				const task = moveTask(p.id, {
					parent_project_id: p.parent_project_id,
					parent_task_id: p.parent_task_id
				});

				if (!task) {
					respond(false, undefined, { code: 'PM_NOT_FOUND', message: `Task ${p.id} not found` });
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'moved',
					entityType: 'task',
					entityId: task.id,
					projectId: task.parent_project_id,
					actor,
					data: task as unknown as Record<string, unknown>
				});
				context.broadcast('event:pm', event);

				respond(true, task);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.task.reorder',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { ids: number[] };
				reorderTasks(p.ids);

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'reordered',
					entityType: 'task',
					entityId: 'bulk',
					actor,
					data: { ids: p.ids }
				});
				context.broadcast('event:pm', event);

				respond(true, { success: true });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.task.delete',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: number };
				const success = deleteTask(p.id);

				if (!success) {
					respond(false, undefined, { code: 'PM_NOT_FOUND', message: `Task ${p.id} not found` });
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'deleted',
					entityType: 'task',
					entityId: p.id,
					actor,
					data: { id: p.id }
				});
				context.broadcast('event:pm', event);

				respond(true, { success: true });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	// ============================================================================
	// COMMENTS (4)
	// ============================================================================

	api.registerGatewayMethod(
		'pm.comment.list',
		async ({ params, respond }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { targetType: string; targetId: number };
				const comments = listComments(p.targetType, p.targetId);
				respond(true, { comments });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.comment.create',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as {
					target_type: string;
					target_id: number;
					body: string;
					author: string;
				};
				const comment = createComment({
					target_type: p.target_type,
					target_id: p.target_id,
					body: p.body,
					author: p.author
				});

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'created',
					entityType: 'comment',
					entityId: comment.id,
					actor,
					data: comment as unknown as Record<string, unknown>
				});
				context.broadcast('event:pm', event);

				respond(true, comment);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.comment.update',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: number; body: string };
				const db = getDb();
				db.prepare('UPDATE comments SET body = ? WHERE id = ?').run(p.body, p.id);
				const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(p.id) as
					| Record<string, unknown>
					| undefined;

				if (!comment) {
					respond(false, undefined, { code: 'PM_NOT_FOUND', message: `Comment ${p.id} not found` });
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'updated',
					entityType: 'comment',
					entityId: comment.id as number,
					actor,
					data: comment
				});
				context.broadcast('event:pm', event);

				respond(true, comment);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.comment.delete',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: number };
				const success = deleteComment(p.id);

				if (!success) {
					respond(false, undefined, { code: 'PM_NOT_FOUND', message: `Comment ${p.id} not found` });
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'deleted',
					entityType: 'comment',
					entityId: p.id,
					actor,
					data: { id: p.id }
				});
				context.broadcast('event:pm', event);

				respond(true, { success: true });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	// ============================================================================
	// BLOCKS (3)
	// ============================================================================

	api.registerGatewayMethod(
		'pm.block.list',
		async ({ params, respond }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { taskId: number };
				const result = listBlocks(p.taskId);
				respond(true, result);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.block.create',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { blockerId: number; blockedId: number };

				// Validate tasks exist
				validateTaskExists(p.blockerId);
				validateTaskExists(p.blockedId);

				// Get existing blocks for cycle detection
				const db = getDb();
				const existingBlocks = db.prepare('SELECT blocker_id, blocked_id FROM blocks').all() as {
					blocker_id: number;
					blocked_id: number;
				}[];

				// Validate uniqueness and no cycles
				validateBlockUnique(p.blockerId, p.blockedId);
				validateBlockNoCycle(p.blockerId, p.blockedId, existingBlocks);

				const block = createBlock(p.blockerId, p.blockedId);

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'created',
					entityType: 'block',
					entityId: `${p.blockerId}-${p.blockedId}`,
					actor,
					data: block as unknown as Record<string, unknown>
				});
				context.broadcast('event:pm', event);

				respond(true, block);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.block.delete',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { blockerId: number; blockedId: number };
				const success = deleteBlock(p.blockerId, p.blockedId);

				if (!success) {
					respond(false, undefined, { code: 'PM_NOT_FOUND', message: 'Block not found' });
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'deleted',
					entityType: 'block',
					entityId: `${p.blockerId}-${p.blockedId}`,
					actor,
					data: { blocker_id: p.blockerId, blocked_id: p.blockedId }
				});
				context.broadcast('event:pm', event);

				respond(true, { success: true });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	// ============================================================================
	// ATTACHMENTS (3)
	// ============================================================================

	api.registerGatewayMethod(
		'pm.attachment.list',
		async ({ params, respond }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { targetType: string; targetId: number };
				const attachments = listAttachments(p.targetType, p.targetId);
				respond(true, { attachments });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.attachment.create',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as {
					target_type: string;
					target_id: number;
					file_path: string;
					file_name: string;
					description?: string;
					added_by: string;
				};
				const attachment = createAttachment({
					target_type: p.target_type,
					target_id: p.target_id,
					file_path: p.file_path,
					file_name: p.file_name,
					description: p.description,
					added_by: p.added_by
				});

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'created',
					entityType: 'attachment',
					entityId: attachment.id,
					actor,
					data: attachment as unknown as Record<string, unknown>
				});
				context.broadcast('event:pm', event);

				respond(true, attachment);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.attachment.delete',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { id: number };
				const success = deleteAttachment(p.id);

				if (!success) {
					respond(false, undefined, {
						code: 'PM_NOT_FOUND',
						message: `Attachment ${p.id} not found`
					});
					return;
				}

				const actor = (client?.connect as any)?.client?.id || 'system';
				const event = emitPMEvent({
					action: 'deleted',
					entityType: 'attachment',
					entityId: p.id,
					actor,
					data: { id: p.id }
				});
				context.broadcast('event:pm', event);

				respond(true, { success: true });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	// ============================================================================
	// ACTIVITIES (1)
	// ============================================================================

	api.registerGatewayMethod(
		'pm.activity.list',
		async ({ params, respond }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { projectId: number; limit?: number };
				const activities = listActivities(p.projectId, p.limit);
				respond(true, { activities });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	// ============================================================================
	// CONTEXT (3)
	// ============================================================================

	api.registerGatewayMethod(
		'pm.context.dashboard',
		async ({ respond }: GatewayRequestHandlerOptions) => {
			try {
				const context = generateDashboardContext();
				respond(true, context);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.context.domain',
		async ({ params, respond }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { domainId: string };
				const context = generateDomainContext(p.domainId);
				respond(true, context);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.context.project',
		async ({ params, respond }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as { projectId: number };
				const context = generateProjectContext(p.projectId);
				respond(true, context);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	// ============================================================================
	// SEARCH (1)
	// ============================================================================

	api.registerGatewayMethod(
		'pm.search',
		async ({ params, respond }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as {
					query: string;
					entityType?: string;
					projectId?: number;
					limit?: number;
					offset?: number;
				};
				const results = searchPM(p.query, {
					entityType: p.entityType,
					projectId: p.projectId,
					limit: p.limit,
					offset: p.offset
				});
				respond(true, { results });
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	// ============================================================================
	// BULK (2)
	// ============================================================================

	api.registerGatewayMethod(
		'pm.bulk.update',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as {
					entityType: 'project' | 'task';
					ids: (number | string)[];
					fields: {
						status?: string;
						priority?: string;
						milestone_id?: number | null;
						due_date?: string | null;
					};
				};
				const result = bulkUpdate({
					entityType: p.entityType,
					ids: p.ids,
					fields: p.fields
				});

				if (result.updated > 0) {
					const actor = (client?.connect as any)?.client?.id || 'system';
					const event = emitPMEvent({
						action: 'updated',
						entityType: p.entityType,
						entityId: 'bulk',
						actor,
						data: { updated: result.updated, ids: p.ids, fields: p.fields }
					});
					context.broadcast('event:pm', event);
				}

				respond(true, result);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	api.registerGatewayMethod(
		'pm.bulk.move',
		async ({ params, client, respond, context }: GatewayRequestHandlerOptions) => {
			try {
				const p = params as {
					ids: (number | string)[];
					target: {
						parent_project_id?: number;
						parent_task_id?: number;
					};
				};
				const result = bulkMove({
					ids: p.ids,
					target: p.target
				});

				if (result.updated > 0) {
					const actor = (client?.connect as any)?.client?.id || 'system';
					const event = emitPMEvent({
						action: 'moved',
						entityType: 'task',
						entityId: 'bulk',
						actor,
						data: { updated: result.updated, ids: p.ids, target: p.target }
					});
					context.broadcast('event:pm', event);
				}

				respond(true, result);
			} catch (err) {
				if (err instanceof PMError) {
					respond(false, undefined, { code: err.code, message: err.message });
				} else {
					respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
				}
			}
		}
	);

	// ============================================================================
	// STATS (1)
	// ============================================================================

	api.registerGatewayMethod('pm.stats', async ({ respond }: GatewayRequestHandlerOptions) => {
		try {
			const stats = getPMStats();
			respond(true, stats);
		} catch (err) {
			if (err instanceof PMError) {
				respond(false, undefined, { code: err.code, message: err.message });
			} else {
				respond(false, undefined, { code: 'PM_ERROR', message: (err as Error).message });
			}
		}
	});
}
