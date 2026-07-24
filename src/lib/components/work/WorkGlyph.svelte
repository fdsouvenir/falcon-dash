<script lang="ts">
	import type { Icon as IconType } from '@lucide/svelte';
	import {
		Circle,
		CircleHelp,
		FileSearch,
		Flag,
		FolderKanban,
		GitPullRequestArrow,
		LayoutGrid,
		Map,
		OctagonAlert,
		Scale,
		SquareCheck,
		Timer
	} from '@lucide/svelte';

	interface Props {
		type: string;
		/** Tile edge in px. */
		size?: number;
	}

	let { type, size = 26 }: Props = $props();

	const GLYPHS: Record<string, { icon: typeof IconType; hue: string }> = {
		task: { icon: SquareCheck, hue: 'var(--work-type-task)' },
		question: { icon: CircleHelp, hue: 'var(--work-type-question)' },
		open_question: { icon: CircleHelp, hue: 'var(--work-type-question)' },
		decision: { icon: Scale, hue: 'var(--work-type-decision)' },
		change: { icon: GitPullRequestArrow, hue: 'var(--work-type-change)' },
		change_request: { icon: GitPullRequestArrow, hue: 'var(--work-type-change)' },
		finding: { icon: FileSearch, hue: 'var(--work-type-finding)' },
		project: { icon: FolderKanban, hue: 'var(--work-type-project)' },
		plan: { icon: Map, hue: 'var(--work-type-plan)' },
		milestone: { icon: Flag, hue: 'var(--work-type-milestone)' },
		automaton: { icon: Timer, hue: 'var(--work-type-automation)' },
		automation: { icon: Timer, hue: 'var(--work-type-automation)' },
		area: { icon: LayoutGrid, hue: 'var(--work-type-area)' },
		blocker: { icon: OctagonAlert, hue: 'var(--work-type-blocker)' }
	};

	const glyph = $derived(GLYPHS[type] ?? { icon: Circle, hue: 'var(--work-type-area)' });
	const Icon = $derived(glyph.icon);
</script>

<!-- Type identity tile (docs/DESIGN.md): icon at full hue on a low-alpha wash
     of the same hue. The hue never leaves the tile. -->
<span
	class="inline-flex shrink-0 items-center justify-center rounded-[7px]"
	style="width:{size}px;height:{size}px;color:{glyph.hue};background:color-mix(in srgb, {glyph.hue} 14%, transparent)"
	aria-hidden="true"
>
	<Icon style="width:{Math.round(size * 0.58)}px;height:{Math.round(size * 0.58)}px" />
</span>
