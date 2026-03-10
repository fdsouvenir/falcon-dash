/**
 * Falcon Dash Design System — Tokens
 *
 * Single source of truth for colors, typography, spacing, and component variants.
 * All pages and components should import from here instead of hardcoding values.
 *
 * CSS custom properties are defined in app.css (:root).
 * This file provides typed JS constants for use in Svelte components and utilities.
 */

/* ── Surface Layers ── */
export const SURFACE = {
	/** Page background — deepest layer */
	0: 'bg-surface-0',
	/** Panel / sidebar background */
	1: 'bg-surface-1',
	/** Card background */
	2: 'bg-surface-2',
	/** Nested card / hover state */
	3: 'bg-surface-3',
	/** Subtle border between surfaces */
	border: 'border-surface-border'
} as const;

/* ── Semantic Status Colors ── */
export type StatusKey = 'active' | 'warning' | 'danger' | 'info' | 'muted' | 'purple';

export const STATUS_COLORS: Record<StatusKey, { text: string; bg: string; dot: string }> = {
	active: {
		text: 'text-status-active',
		bg: 'bg-status-active-bg',
		dot: 'bg-status-active'
	},
	warning: {
		text: 'text-status-warning',
		bg: 'bg-status-warning-bg',
		dot: 'bg-status-warning'
	},
	danger: {
		text: 'text-status-danger',
		bg: 'bg-status-danger-bg',
		dot: 'bg-status-danger'
	},
	info: {
		text: 'text-status-info',
		bg: 'bg-status-info-bg',
		dot: 'bg-status-info'
	},
	muted: {
		text: 'text-status-muted',
		bg: 'bg-status-muted-bg',
		dot: 'bg-status-muted'
	},
	purple: {
		text: 'text-status-purple',
		bg: 'bg-status-purple-bg',
		dot: 'bg-status-purple'
	}
};

/* ── Status Mapping (project/task status → semantic color) ── */
export type ProjectStatus =
	| 'todo'
	| 'in_progress'
	| 'review'
	| 'done'
	| 'blocked'
	| 'cancelled'
	| 'archived';

export const STATUS_MAP: Record<ProjectStatus, StatusKey> = {
	todo: 'info',
	in_progress: 'active',
	review: 'warning',
	done: 'active',
	blocked: 'danger',
	cancelled: 'danger',
	archived: 'muted'
};

export function getStatusColor(status: string): StatusKey {
	return STATUS_MAP[status as ProjectStatus] ?? 'muted';
}

/* ── Priority ── */
export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'normal' | 'low' | null;

export const PRIORITY: Record<string, { emoji: string; color: StatusKey; label: string }> = {
	urgent: { emoji: '🔴', color: 'danger', label: 'Urgent' },
	high: { emoji: '🔴', color: 'danger', label: 'High' },
	medium: { emoji: '🟡', color: 'warning', label: 'Medium' },
	normal: { emoji: '🟢', color: 'active', label: 'Normal' },
	low: { emoji: '🟢', color: 'active', label: 'Low' }
};

export function getPriority(level: string | null) {
	if (!level) return null;
	return PRIORITY[level] ?? null;
}

/* ── Plan Status Colors ── */
export type PlanStatus = 'planning' | 'assigned' | 'in_progress' | 'needs_review' | 'complete' | 'cancelled';

export const PLAN_STATUS_MAP: Record<PlanStatus, StatusKey> = {
	planning: 'info',
	assigned: 'purple',
	in_progress: 'active',
	needs_review: 'warning',
	complete: 'active',
	cancelled: 'muted'
};

export function getPlanStatusColor(status: string): StatusKey {
	return PLAN_STATUS_MAP[status as PlanStatus] ?? 'muted';
}

/* ── Typography Utility Classes ── */
export const TEXT = {
	/** Page title — 20px / bold */
	pageTitle: 'text-[length:var(--text-page-title)] font-bold',
	/** Section header — 11px / bold / uppercase / tracked */
	sectionHeader:
		'text-[length:var(--text-section-header)] font-bold uppercase tracking-wider text-status-muted',
	/** Card title — 14px / medium */
	cardTitle: 'text-[length:var(--text-card-title)] font-medium',
	/** Body text — 13px / normal */
	body: 'text-[length:var(--text-body)]',
	/** Label text — 11px / medium / muted */
	label: 'text-[length:var(--text-label)] font-medium text-status-muted',
	/** Badge text — 10px / semibold */
	badge: 'text-[length:var(--text-badge)] font-semibold',
	/** Monospace — 12px */
	mono: 'text-[length:var(--text-mono)] font-mono'
} as const;

/* ── Spacing Utility Classes ── */
export const SPACE = {
	/** Card internal padding */
	cardPadding: 'p-[var(--space-card-padding)]',
	/** Gap between cards in a grid */
	cardGap: 'gap-[var(--space-card-gap)]',
	/** Gap between page sections */
	sectionGap: 'gap-[var(--space-section-gap)]',
	/** Row item padding */
	rowPadding: 'px-[var(--space-row-x)] py-[var(--space-row-y)]',
	/** Badge padding */
	badgePadding: 'px-[var(--space-badge-x)] py-[var(--space-badge-y)]'
} as const;

/* ── Component Style Presets ── */
export const CARD = {
	/** Standard card — surface-2 bg, border, rounded */
	base: 'bg-surface-2 border border-surface-border rounded-lg',
	/** Card hover state */
	hover: 'hover:bg-surface-3 transition-colors',
	/** Selected card state */
	selected: 'bg-surface-3 border-status-info/30'
} as const;

export const BADGE = {
	/** Status badge — pill shape with semantic color */
	status: (status: StatusKey) => {
		const c = STATUS_COLORS[status];
		return `${c.text} ${c.bg} ${TEXT.badge} ${SPACE.badgePadding} rounded-full`;
	},
	/** Count badge — small rounded with muted style */
	count: `${TEXT.badge} ${SPACE.badgePadding} rounded-full bg-surface-3 text-status-muted`
} as const;

/* ── Tool Colors (for Ops Observer activity feed) ── */
export const TOOL_COLORS: Record<string, StatusKey> = {
	exec: 'active',
	web_search: 'info',
	web_fetch: 'info',
	read: 'muted',
	write: 'warning',
	edit: 'warning',
	message: 'purple',
	cron: 'warning',
	sessions_spawn: 'purple',
	memory_search: 'muted',
	memory_get: 'muted',
	browser: 'info',
	image: 'info',
	gateway: 'danger'
};

export function getToolColor(toolName: string): StatusKey {
	return TOOL_COLORS[toolName] ?? 'muted';
}
