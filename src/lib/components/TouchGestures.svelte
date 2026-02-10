<script lang="ts">
	interface Props {
		children: import('svelte').Snippet;
		onSwipeBack?: () => void;
		onPullRefresh?: () => Promise<void>;
		onLongPress?: (e: TouchEvent) => void;
	}

	let { children, onSwipeBack, onPullRefresh, onLongPress }: Props = $props();

	let touchStartX = $state(0);
	let touchStartY = $state(0);
	let touchStartTime = $state(0);
	let pullDistance = $state(0);
	let isRefreshing = $state(false);

	function handleTouchStart(e: TouchEvent) {
		const touch = e.touches[0];
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
		touchStartTime = Date.now();

		// Long press detection
		if (onLongPress) {
			const longPressTimer = setTimeout(() => {
				onLongPress(e);
			}, 500);

			const clearTimer = () => {
				clearTimeout(longPressTimer);
				document.removeEventListener('touchend', clearTimer);
				document.removeEventListener('touchmove', clearTimer);
			};

			document.addEventListener('touchend', clearTimer);
			document.addEventListener('touchmove', clearTimer);
		}
	}

	function handleTouchMove(e: TouchEvent) {
		const touch = e.touches[0];
		const deltaY = touch.clientY - touchStartY;

		// Pull-to-refresh
		if (onPullRefresh && deltaY > 0 && window.scrollY === 0 && !isRefreshing) {
			pullDistance = Math.min(deltaY, 100);
		}
	}

	async function handleTouchEnd(e: TouchEvent) {
		const touch = e.changedTouches[0];
		const deltaX = touch.clientX - touchStartX;
		const deltaY = touch.clientY - touchStartY;
		const deltaTime = Date.now() - touchStartTime;

		// Swipe back (right swipe)
		if (onSwipeBack && deltaX > 100 && Math.abs(deltaY) < 50 && deltaTime < 300) {
			onSwipeBack();
		}

		// Pull-to-refresh trigger
		if (onPullRefresh && pullDistance > 60 && !isRefreshing) {
			isRefreshing = true;
			await onPullRefresh();
			isRefreshing = false;
		}

		pullDistance = 0;
		touchStartX = 0;
		touchStartY = 0;
		touchStartTime = 0;
	}
</script>

<div
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
	class="relative"
	role="region"
	aria-label="Touch gesture area"
>
	{#if pullDistance > 0}
		<div
			class="absolute left-0 right-0 top-0 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20"
			style="height: {pullDistance}px"
		>
			<span class="text-sm text-blue-600 dark:text-blue-400">
				{pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}
			</span>
		</div>
	{/if}

	{#if isRefreshing}
		<div
			class="absolute left-0 right-0 top-0 flex items-center justify-center bg-blue-50 py-2 dark:bg-blue-900/20"
		>
			<span class="text-sm text-blue-600 dark:text-blue-400">Refreshing...</span>
		</div>
	{/if}

	{@render children()}
</div>

<style>
	:global(.touch-target) {
		min-width: 44px;
		min-height: 44px;
	}
</style>
