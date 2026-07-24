<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { toneFor } from '$lib/work3/tones.js';

	interface Props {
		type: string;
		value: string | null | undefined;
		label?: string;
		class?: string;
	}

	let { type, value, label, class: className }: Props = $props();
</script>

<Badge variant={toneFor(type, value)} class={className}>
	{label ?? value?.replaceAll('_', ' ') ?? 'Unknown'}
</Badge>
