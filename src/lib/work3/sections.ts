export interface QuestionBriefSection {
	id: string;
	title: string;
	content: string;
	defaultOpen: boolean;
	category: 'context' | 'decision' | 'approval' | 'risks' | 'history';
}

const defaultOpenTitles = [
	'objective',
	'question',
	'current state',
	'current verified state',
	'recommendation',
	'approval gate'
];

const defaultCollapsedTitles = [
	'scope',
	'out of scope',
	'acceptance criteria',
	'review',
	'snapshot',
	'legacy version history',
	'version history'
];

export function parseQuestionSections(markdown: string): QuestionBriefSection[] {
	const source = markdown.trim();
	if (!source) {
		return [
			{
				id: 'context',
				title: 'Context',
				content: 'No question context recorded yet.',
				defaultOpen: true,
				category: 'context'
			}
		];
	}

	const matches = [...source.matchAll(/^##\s+(.+?)\s*$/gm)];
	if (matches.length === 0) {
		return [
			{
				id: 'context',
				title: 'Context',
				content: source,
				defaultOpen: true,
				category: 'context'
			}
		];
	}

	const sections: QuestionBriefSection[] = [];
	const usedIds = new Map<string, number>();
	const firstMatch = matches[0];
	const preamble = source.slice(0, firstMatch.index).trim();
	if (preamble) {
		sections.push({
			id: uniqueSectionId('summary', usedIds),
			title: 'Summary',
			content: preamble,
			defaultOpen: true,
			category: 'context'
		});
	}

	matches.forEach((match, index) => {
		const title = match[1].trim();
		const start = (match.index ?? 0) + match[0].length;
		const end = matches[index + 1]?.index ?? source.length;
		sections.push({
			id: uniqueSectionId(slugify(title), usedIds),
			title,
			content: source.slice(start, end).trim() || 'No details recorded.',
			defaultOpen: shouldOpenQuestionSection(title, index, matches.length),
			category: questionSectionCategory(title)
		});
	});

	const hasPreferredOpen = sections.some((section) =>
		defaultOpenTitles.includes(normalizeTitle(section.title))
	);
	if (!hasPreferredOpen) {
		return sections.map((section, index) => ({
			...section,
			defaultOpen: index < 2 && !isCollapsedTitle(section.title)
		}));
	}

	return sections;
}

function shouldOpenQuestionSection(title: string, index: number, total: number): boolean {
	if (index >= 6) return false;
	if (isCollapsedTitle(title)) return false;
	const normalized = normalizeTitle(title);
	if (defaultOpenTitles.includes(normalized)) return true;
	return total <= 2 && index < 2;
}

function questionSectionCategory(title: string): QuestionBriefSection['category'] {
	const normalized = normalizeTitle(title);
	if (normalized.includes('approval')) return 'approval';
	if (normalized.includes('risk') || normalized.includes('out of scope')) return 'risks';
	if (
		normalized.includes('history') ||
		normalized.includes('snapshot') ||
		normalized.includes('review')
	) {
		return 'history';
	}
	if (normalized.includes('question') || normalized.includes('recommendation')) return 'decision';
	return 'context';
}

function isCollapsedTitle(title: string): boolean {
	const normalized = normalizeTitle(title);
	return defaultCollapsedTitles.some((collapsed) => normalized.includes(collapsed));
}

function normalizeTitle(title: string): string {
	return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function slugify(value: string): string {
	const slug = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return slug || 'section';
}

function uniqueSectionId(baseId: string, usedIds: Map<string, number>): string {
	const count = usedIds.get(baseId) ?? 0;
	usedIds.set(baseId, count + 1);
	if (count === 0) return baseId;
	return `${baseId}-${count + 1}`;
}
