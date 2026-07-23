/**
 * Type-prefixed public IDs (doc 06): short, token-efficient, conversational
 * (`t42`, `q7`, `p3`). Automatons deliberately have no prefix here — their
 * identity is the OpenClaw job id (one-aggregate contract).
 */

export const WORK3_TYPE_PREFIXES = {
	area: 'a',
	task: 't',
	question: 'q',
	decision: 'd',
	change_request: 'c',
	project: 'p',
	phase: 'ph',
	milestone: 'm',
	plan: 'pl',
	finding: 'f',
	review: 'rv',
	authorization: 'az',
	blocker: 'b'
} as const;

export type Work3EntityType = keyof typeof WORK3_TYPE_PREFIXES;

const PREFIX_TO_TYPE: ReadonlyMap<string, Work3EntityType> = new Map(
	(Object.entries(WORK3_TYPE_PREFIXES) as Array<[Work3EntityType, string]>).map(
		([type, prefix]) => [prefix, type]
	)
);

const PUBLIC_ID_PATTERN = /^([a-z]+)([1-9][0-9]*)$/;

export function formatPublicId(type: Work3EntityType, seq: number): string {
	return `${WORK3_TYPE_PREFIXES[type]}${seq}`;
}

export function parsePublicId(id: string): { type: Work3EntityType; seq: number } | null {
	const match = PUBLIC_ID_PATTERN.exec(id);
	if (!match) return null;
	const type = PREFIX_TO_TYPE.get(match[1]);
	if (!type) return null;
	return { type, seq: Number(match[2]) };
}
