<script lang="ts">
	import { page } from '$app/state';
	import WorkSurface from '$lib/components/work/WorkSurface.svelte';

	const section = $derived(page.params.section);
	const id = $derived(Number(page.params.id));
</script>

<WorkSurface mode="detail" {section} {id} />
