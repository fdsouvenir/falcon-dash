/**
 * Touch gesture utilities for mobile interactions.
 * Provides Svelte actions for swipe, long-press, and pull-to-refresh.
 */

export interface SwipeParams {
	onSwipeLeft?: () => void;
	onSwipeRight?: () => void;
	onSwipeUp?: () => void;
	onSwipeDown?: () => void;
	threshold?: number;
}

/**
 * Svelte action for swipe gesture detection.
 * Usage: <div use:swipe={{ onSwipeRight: goBack, threshold: 50 }}>
 */
export function swipe(node: HTMLElement, params: SwipeParams) {
	let startX = 0;
	let startY = 0;
	let startTime = 0;
	const threshold = params.threshold ?? 50;
	const maxTime = 500;

	function onTouchStart(e: TouchEvent) {
		const touch = e.touches[0];
		startX = touch.clientX;
		startY = touch.clientY;
		startTime = Date.now();
	}

	function onTouchEnd(e: TouchEvent) {
		const touch = e.changedTouches[0];
		const dx = touch.clientX - startX;
		const dy = touch.clientY - startY;
		const elapsed = Date.now() - startTime;

		if (elapsed > maxTime) return;

		const absDx = Math.abs(dx);
		const absDy = Math.abs(dy);

		// Require dominant axis
		if (absDx < threshold && absDy < threshold) return;

		if (absDx > absDy) {
			if (dx > threshold && params.onSwipeRight) {
				params.onSwipeRight();
			} else if (dx < -threshold && params.onSwipeLeft) {
				params.onSwipeLeft();
			}
		} else {
			if (dy > threshold && params.onSwipeDown) {
				params.onSwipeDown();
			} else if (dy < -threshold && params.onSwipeUp) {
				params.onSwipeUp();
			}
		}
	}

	node.addEventListener('touchstart', onTouchStart, { passive: true });
	node.addEventListener('touchend', onTouchEnd, { passive: true });

	return {
		update(newParams: SwipeParams) {
			params = newParams;
		},
		destroy() {
			node.removeEventListener('touchstart', onTouchStart);
			node.removeEventListener('touchend', onTouchEnd);
		}
	};
}

export interface LongPressParams {
	onLongPress: (x: number, y: number) => void;
	duration?: number;
}

/**
 * Svelte action for long-press gesture detection.
 * Fires callback with touch position after holding for duration ms.
 * Usage: <div use:longpress={{ onLongPress: showMenu, duration: 500 }}>
 */
export function longpress(node: HTMLElement, params: LongPressParams) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let startX = 0;
	let startY = 0;
	const moveThreshold = 10;

	function onTouchStart(e: TouchEvent) {
		const touch = e.touches[0];
		startX = touch.clientX;
		startY = touch.clientY;

		timer = setTimeout(() => {
			params.onLongPress(startX, startY);
		}, params.duration ?? 500);
	}

	function onTouchMove(e: TouchEvent) {
		if (!timer) return;
		const touch = e.touches[0];
		const dx = Math.abs(touch.clientX - startX);
		const dy = Math.abs(touch.clientY - startY);
		if (dx > moveThreshold || dy > moveThreshold) {
			clearTimeout(timer);
			timer = undefined;
		}
	}

	function onTouchEnd() {
		if (timer) {
			clearTimeout(timer);
			timer = undefined;
		}
	}

	node.addEventListener('touchstart', onTouchStart, { passive: true });
	node.addEventListener('touchmove', onTouchMove, { passive: true });
	node.addEventListener('touchend', onTouchEnd, { passive: true });
	node.addEventListener('touchcancel', onTouchEnd, { passive: true });

	return {
		update(newParams: LongPressParams) {
			params = newParams;
		},
		destroy() {
			if (timer) clearTimeout(timer);
			node.removeEventListener('touchstart', onTouchStart);
			node.removeEventListener('touchmove', onTouchMove);
			node.removeEventListener('touchend', onTouchEnd);
			node.removeEventListener('touchcancel', onTouchEnd);
		}
	};
}

export interface PullToRefreshParams {
	onRefresh: () => Promise<void> | void;
	threshold?: number;
}

/**
 * Svelte action for pull-to-refresh on scrollable containers.
 * Only activates when scrolled to top and pulling down.
 * Usage: <div use:pullToRefresh={{ onRefresh: loadData }}>
 */
export function pullToRefresh(node: HTMLElement, params: PullToRefreshParams) {
	let startY = 0;
	let pulling = false;
	let refreshing = false;
	let indicator: HTMLDivElement | null = null;
	const threshold = params.threshold ?? 80;

	function createIndicator() {
		indicator = document.createElement('div');
		indicator.className =
			'pull-refresh-indicator absolute left-0 right-0 top-0 z-10 flex items-center justify-center py-2 text-xs text-slate-400 transition-opacity';
		indicator.style.opacity = '0';
		indicator.textContent = 'Pull to refresh';
		node.style.position = 'relative';
		node.insertBefore(indicator, node.firstChild);
	}

	function removeIndicator() {
		if (indicator && indicator.parentNode) {
			indicator.parentNode.removeChild(indicator);
			indicator = null;
		}
	}

	function onTouchStart(e: TouchEvent) {
		if (refreshing) return;
		if (node.scrollTop > 0) return;
		startY = e.touches[0].clientY;
		pulling = true;
		if (!indicator) createIndicator();
	}

	function onTouchMove(e: TouchEvent) {
		if (!pulling || refreshing) return;
		const dy = e.touches[0].clientY - startY;
		if (dy < 0) {
			pulling = false;
			if (indicator) indicator.style.opacity = '0';
			return;
		}

		if (indicator) {
			const progress = Math.min(dy / threshold, 1);
			indicator.style.opacity = String(progress);
			indicator.textContent = dy >= threshold ? 'Release to refresh' : 'Pull to refresh';
		}
	}

	async function onTouchEnd(e: TouchEvent) {
		if (!pulling || refreshing) return;
		pulling = false;
		const dy = e.changedTouches[0].clientY - startY;

		if (dy >= threshold) {
			refreshing = true;
			if (indicator) {
				indicator.textContent = 'Refreshing...';
				indicator.style.opacity = '1';
			}
			try {
				await params.onRefresh();
			} finally {
				refreshing = false;
				if (indicator) {
					indicator.style.opacity = '0';
					setTimeout(removeIndicator, 200);
				}
			}
		} else {
			if (indicator) {
				indicator.style.opacity = '0';
				setTimeout(removeIndicator, 200);
			}
		}
	}

	node.addEventListener('touchstart', onTouchStart, { passive: true });
	node.addEventListener('touchmove', onTouchMove, { passive: true });
	node.addEventListener('touchend', onTouchEnd, { passive: true });

	return {
		update(newParams: PullToRefreshParams) {
			params = newParams;
		},
		destroy() {
			removeIndicator();
			node.removeEventListener('touchstart', onTouchStart);
			node.removeEventListener('touchmove', onTouchMove);
			node.removeEventListener('touchend', onTouchEnd);
		}
	};
}
