<script lang="ts">
	import { page } from '$app/state';
	import WorkSurface from '$lib/components/work/WorkSurface.svelte';

	const section = $derived(page.params.section);
</script>

<WorkSurface mode="section" {section} />
