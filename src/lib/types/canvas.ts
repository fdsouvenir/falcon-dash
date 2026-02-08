/**
 * Canvas & A2UI types for falcon-dash.
 *
 * A2UI is a declarative, schema-based UI rendering system.
 * Messages are sent as JSONL (one JSON object per line) and describe
 * component trees, data bindings, and user actions.
 */

// ---------------------------------------------------------------------------
// A2UI Message Protocol (v0.8)
// ---------------------------------------------------------------------------

/** Base fields shared by all A2UI messages */
export interface A2UIMessageBase {
	type: string;
}

/** Define or update components on a surface */
export interface A2UISurfaceUpdate extends A2UIMessageBase {
	type: 'surfaceUpdate';
	surface: string;
	components: A2UIComponent[];
}

/** Signal the client to start rendering a surface with a root component */
export interface A2UIBeginRendering extends A2UIMessageBase {
	type: 'beginRendering';
	surface: string;
	rootComponentId: string;
}

/** Update the reactive data model at a given path */
export interface A2UIDataModelUpdate extends A2UIMessageBase {
	type: 'dataModelUpdate';
	path: string;
	value: unknown;
}

/** Remove a surface */
export interface A2UIDeleteSurface extends A2UIMessageBase {
	type: 'deleteSurface';
	surface: string;
}

/** Union of all A2UI message types */
export type A2UIMessage =
	| A2UISurfaceUpdate
	| A2UIBeginRendering
	| A2UIDataModelUpdate
	| A2UIDeleteSurface;

// ---------------------------------------------------------------------------
// A2UI Component Types
// ---------------------------------------------------------------------------

/** Data binding — either a literal value or a reactive path */
export type A2UIDataBinding =
	| { literalString: string }
	| { literalNumber: number }
	| { literalBool: boolean }
	| { path: string };

/** Template child for dynamic list rendering */
export interface A2UITemplateChild {
	componentId: string;
	dataBinding: string;
}

/** A2UI component definition */
export interface A2UIComponent {
	id: string;
	type: string;
	properties?: Record<string, A2UIDataBinding | unknown>;
	children?: string[];
	templateChildren?: A2UITemplateChild;
	weight?: number;
}

// ---------------------------------------------------------------------------
// A2UI User Actions (Action Bridge)
// ---------------------------------------------------------------------------

/** User action emitted by interactive A2UI components */
export interface A2UIUserAction {
	name: string;
	context?: Record<string, unknown>;
}

/** Payload sent from the action bridge */
export interface A2UIActionPayload {
	userAction: A2UIUserAction;
}

// ---------------------------------------------------------------------------
// A2UI Host Element Interface
// ---------------------------------------------------------------------------

/** Public API of the <openclaw-a2ui-host> Lit web component */
export interface A2UIHostElement extends HTMLElement {
	applyMessages(messages: Array<Record<string, unknown>>): void;
	reset(): void;
}

// ---------------------------------------------------------------------------
// A2UI Bundle Loading State
// ---------------------------------------------------------------------------

export type A2UIBundleState = 'idle' | 'loading' | 'ready' | 'error';

// ---------------------------------------------------------------------------
// Canvas Frame (Sandboxed HTML Canvas)
// ---------------------------------------------------------------------------

/** Configuration for a sandboxed HTML canvas iframe */
export interface CanvasFrameConfig {
	/** Canvas host base URL (e.g. http://host:18793/__openclaw__/canvas/) */
	baseUrl: string;
	/** Canvas path relative to the base URL */
	path: string;
	/** Optional title for the canvas */
	title?: string;
}

// ---------------------------------------------------------------------------
// Custom Apps (Pinned Canvas Views)
// ---------------------------------------------------------------------------

/** Rendering mode for a custom app */
export type CustomAppMode = 'a2ui' | 'canvas';

/** A pinned custom app entry */
export interface CustomApp {
	/** Unique identifier */
	id: string;
	/** Display name (agent-provided or user-edited) */
	name: string;
	/** Rendering mode */
	mode: CustomAppMode;
	/** Sort order (lower = higher in list) */
	order: number;
	/** For canvas mode: iframe URL path */
	canvasPath?: string;
	/** For a2ui mode: last known messages */
	a2uiMessages?: Array<Record<string, unknown>>;
	/** Timestamp when pinned */
	pinnedAt: number;
}
