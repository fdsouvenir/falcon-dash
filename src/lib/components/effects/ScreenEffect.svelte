<script lang="ts">
	import { onMount } from 'svelte';

	let {
		name,
		ondone
	}: {
		name: string;
		ondone: () => void;
	} = $props();

	let reducedMotion = $state(false);

	interface Particle {
		id: number;
		style: string;
		text?: string;
		childStyle?: string;
	}

	let particles = $state<Particle[]>([]);

	onMount(() => {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reducedMotion) {
			ondone();
			return;
		}

		particles = generateParticles();

		const timer = setTimeout(ondone, DURATIONS[name] ?? 4000);
		return () => clearTimeout(timer);
	});

	const DURATIONS: Record<string, number> = {
		confetti: 4000,
		fireworks: 3500,
		hearts: 4000,
		balloons: 5000,
		celebration: 3500,
		lasers: 3000,
		spotlight: 3000,
		echo: 3000
	};

	function generateParticles(): Particle[] {
		switch (name) {
			case 'confetti':
				return createConfetti();
			case 'fireworks':
				return createFireworks();
			case 'hearts':
				return createHearts();
			case 'balloons':
				return createBalloons();
			case 'celebration':
				return createCelebration();
			case 'lasers':
				return createLasers();
			case 'spotlight':
				return createSpotlight();
			case 'echo':
				return createEcho();
			default:
				return [];
		}
	}

	const CONFETTI_COLORS = [
		'#ff6b6b',
		'#ffd93d',
		'#6bcb77',
		'#4d96ff',
		'#ff6eb4',
		'#a855f7',
		'#fb923c'
	];

	function createConfetti(): Particle[] {
		return Array.from({ length: 60 }, (_, i) => {
			const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
			const left = Math.random() * 100;
			const delay = Math.random() * 1.5;
			const size = 6 + Math.random() * 6;
			const rotation = Math.random() * 360;
			const duration = 2 + Math.random() * 2;
			return {
				id: i,
				style: `position:absolute;left:${left}%;top:-10px;width:${size}px;height:${size * 0.4}px;background-color:${color};border-radius:1px;transform:rotate(${rotation}deg);animation:screen-confetti-fall ${duration}s ease-in ${delay}s forwards`
			};
		});
	}

	function createFireworks(): Particle[] {
		const result: Particle[] = [];
		let id = 0;
		for (let burst = 0; burst < 3; burst++) {
			const cx = 20 + Math.random() * 60;
			const cy = 20 + Math.random() * 40;
			const delay = burst * 0.6;
			for (let i = 0; i < 20; i++) {
				const angle = (i / 20) * 360;
				const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
				result.push({
					id: id++,
					style: `position:absolute;left:${cx}%;top:${cy}%;width:4px;height:4px;background-color:${color};border-radius:50%;animation:screen-firework-burst 1.2s ease-out ${delay}s forwards;--angle:${angle}deg`
				});
			}
		}
		return result;
	}

	function createHearts(): Particle[] {
		return Array.from({ length: 20 }, (_, i) => {
			const left = 10 + Math.random() * 80;
			const delay = Math.random() * 2;
			const size = 16 + Math.random() * 20;
			const duration = 3 + Math.random();
			return {
				id: i,
				style: `position:absolute;left:${left}%;bottom:-30px;font-size:${size}px;animation:screen-float-up ${duration}s ease-out ${delay}s forwards;opacity:0`,
				text: '\u2764\uFE0F'
			};
		});
	}

	function createBalloons(): Particle[] {
		const balloonColors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6eb4', '#a855f7'];
		return Array.from({ length: 12 }, (_, i) => {
			const left = 5 + Math.random() * 90;
			const delay = Math.random() * 1.5;
			const color = balloonColors[Math.floor(Math.random() * balloonColors.length)];
			const size = 30 + Math.random() * 20;
			const duration = 4 + Math.random();
			return {
				id: i,
				style: `position:absolute;left:${left}%;bottom:-60px;width:${size}px;height:${size * 1.2}px;background-color:${color};border-radius:50% 50% 50% 50% / 40% 40% 60% 60%;animation:screen-float-up ${duration}s ease-out ${delay}s forwards;opacity:0`,
				childStyle: `position:absolute;bottom:-15px;left:50%;width:1px;height:15px;background-color:${color};transform:translateX(-50%)`
			};
		});
	}

	function createCelebration(): Particle[] {
		const sparkles = ['\u2728', '\u2B50', '\uD83D\uDCAB'];
		return Array.from({ length: 30 }, (_, i) => {
			const left = Math.random() * 100;
			const top = Math.random() * 100;
			const delay = Math.random() * 2;
			const size = 10 + Math.random() * 14;
			const duration = 0.8 + Math.random() * 0.4;
			return {
				id: i,
				style: `position:absolute;left:${left}%;top:${top}%;font-size:${size}px;animation:screen-twinkle ${duration}s ease-in-out ${delay}s 2;opacity:0`,
				text: sparkles[Math.floor(Math.random() * sparkles.length)]
			};
		});
	}

	function createLasers(): Particle[] {
		const laserColors = ['#ff0040', '#00ff88', '#4d96ff', '#ff6eb4'];
		return Array.from({ length: 6 }, (_, i) => {
			const color = laserColors[i % laserColors.length];
			const top = 10 + Math.random() * 80;
			const delay = i * 0.3;
			return {
				id: i,
				style: `position:absolute;left:0;top:${top}%;width:100%;height:2px;background:linear-gradient(90deg, transparent, ${color}, transparent);animation:screen-laser-sweep 0.8s ease-in-out ${delay}s forwards;opacity:0`
			};
		});
	}

	function createSpotlight(): Particle[] {
		return [
			{
				id: 0,
				style: `position:absolute;left:50%;top:50%;width:0;height:0;border-radius:50%;background:radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%);transform:translate(-50%, -50%);animation:screen-spotlight-pulse 2.5s ease-out forwards`
			}
		];
	}

	function createEcho(): Particle[] {
		return Array.from({ length: 4 }, (_, i) => {
			const delay = i * 0.3;
			const scale = 1 + i * 0.5;
			return {
				id: i,
				style: `position:absolute;left:50%;top:50%;width:100px;height:40px;border:2px solid rgba(148, 163, 184, 0.3);border-radius:8px;transform:translate(-50%, -50%) scale(${scale});animation:screen-echo-ring 1.5s ease-out ${delay}s forwards;opacity:0`
			};
		});
	}
</script>

<div class="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
	{#each particles as particle (particle.id)}
		<div style={particle.style}>
			{#if particle.text}{particle.text}{/if}
			{#if particle.childStyle}
				<div style={particle.childStyle}></div>
			{/if}
		</div>
	{/each}
</div>

<style>
	@keyframes screen-confetti-fall {
		0% {
			transform: translateY(0) rotate(0deg);
			opacity: 1;
		}
		100% {
			transform: translateY(100vh) rotate(720deg);
			opacity: 0;
		}
	}

	@keyframes screen-firework-burst {
		0% {
			transform: translate(0, 0) scale(1);
			opacity: 1;
		}
		100% {
			transform: translate(
					calc(cos(var(--angle, 0deg)) * 120px),
					calc(sin(var(--angle, 0deg)) * 120px)
				)
				scale(0);
			opacity: 0;
		}
	}

	@keyframes screen-float-up {
		0% {
			transform: translateY(0) rotate(0deg);
			opacity: 0;
		}
		10% {
			opacity: 1;
		}
		100% {
			transform: translateY(-110vh) rotate(15deg);
			opacity: 0;
		}
	}

	@keyframes screen-twinkle {
		0%,
		100% {
			opacity: 0;
			transform: scale(0.5);
		}
		50% {
			opacity: 1;
			transform: scale(1.2);
		}
	}

	@keyframes screen-laser-sweep {
		0% {
			opacity: 0;
			transform: scaleX(0);
			transform-origin: left;
		}
		30% {
			opacity: 1;
			transform: scaleX(1);
		}
		70% {
			opacity: 1;
			transform: scaleX(1);
		}
		100% {
			opacity: 0;
			transform: scaleX(0);
			transform-origin: right;
		}
	}

	@keyframes screen-spotlight-pulse {
		0% {
			width: 0;
			height: 0;
			opacity: 0;
		}
		30% {
			width: 300px;
			height: 300px;
			opacity: 1;
		}
		60% {
			width: 600px;
			height: 600px;
			opacity: 0.7;
		}
		100% {
			width: 1200px;
			height: 1200px;
			opacity: 0;
		}
	}

	@keyframes screen-echo-ring {
		0% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(1);
		}
		20% {
			opacity: 0.6;
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -50%) scale(3);
		}
	}
</style>
