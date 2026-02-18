<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	let hasError = $state(false);
	let errorCode = $state<'connection_lost' | 'auth_failed' | 'method_not_found' | 'unknown'>(
		'unknown'
	);
	let errorDetails = $state('');

	function formatErrorMessage(code: typeof errorCode): string {
		const messages = {
			connection_lost: 'Connection to the gateway was lost. Please check your network.',
			auth_failed: 'Authentication failed. Please check your credentials.',
			method_not_found: 'The requested operation is not supported by the gateway.',
			unknown: 'An unexpected error occurred. Please try again.'
		};
		return messages[code];
	}

	function handleError(error: Error) {
		hasError = true;
		errorDetails = error.message;

		// Detect error type
		if (error.message.includes('WebSocket') || error.message.includes('connection')) {
			errorCode = 'connection_lost';
		} else if (error.message.includes('auth') || error.message.includes('token')) {
			errorCode = 'auth_failed';
		} else if (error.message.includes('method') || error.message.includes('not found')) {
			errorCode = 'method_not_found';
		} else {
			errorCode = 'unknown';
		}

		console.error('[ErrorBoundary]', error);
	}

	function retry() {
		hasError = false;
		errorCode = 'unknown';
		errorDetails = '';
		window.location.reload();
	}

	async function reportError() {
		try {
			const Sentry = await import('@sentry/sveltekit');
			Sentry.captureException(new Error(`[${errorCode}] ${errorDetails}`));
		} catch {
			console.log('[ErrorBoundary] Sentry not available, error not reported');
		}
		alert('Error reported. Thank you!');
	}

	$effect(() => {
		const handleGlobalError = (event: ErrorEvent) => {
			event.preventDefault();
			handleError(event.error || new Error(event.message));
		};

		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			event.preventDefault();
			handleError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
		};

		window.addEventListener('error', handleGlobalError);
		window.addEventListener('unhandledrejection', handleUnhandledRejection);

		return () => {
			window.removeEventListener('error', handleGlobalError);
			window.removeEventListener('unhandledrejection', handleUnhandledRejection);
		};
	});
</script>

{#if hasError}
	<div class="fixed inset-0 bg-gray-900 z-50 flex items-center justify-center p-4">
		<div class="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-8 text-center">
			<div class="text-6xl mb-4">⚠️</div>
			<h1 class="text-2xl font-bold mb-4">Something Went Wrong</h1>
			<p class="text-gray-300 mb-2">{formatErrorMessage(errorCode)}</p>
			{#if errorDetails}
				<details class="text-left mt-4 mb-6">
					<summary class="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
						Technical details
					</summary>
					<pre
						class="text-xs text-gray-500 mt-2 p-2 bg-gray-900 rounded overflow-auto max-h-32">{errorDetails}</pre>
				</details>
			{/if}
			<div class="flex gap-4 justify-center mt-6">
				<button
					onclick={retry}
					class="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium"
				>
					Retry
				</button>
				<button onclick={reportError} class="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg">
					Report Error
				</button>
			</div>
		</div>
	</div>
{:else}
	{@render children()}
{/if}
