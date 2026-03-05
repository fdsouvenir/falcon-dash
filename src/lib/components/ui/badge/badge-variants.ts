import { type VariantProps, tv } from 'tailwind-variants';

export const badgeVariants = tv({
	base: 'focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3',
	variants: {
		variant: {
			default: 'bg-primary text-primary-foreground [a&]:hover:bg-primary/90 border-transparent',
			secondary:
				'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90 border-transparent',
			destructive:
				'bg-destructive [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/70 border-transparent text-white',
			outline: 'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
			/* ── Semantic status variants ── */
			active:
				'bg-status-active-bg text-status-active border-transparent',
			warning:
				'bg-status-warning-bg text-status-warning border-transparent',
			danger:
				'bg-status-danger-bg text-status-danger border-transparent',
			info:
				'bg-status-info-bg text-status-info border-transparent',
			muted:
				'bg-status-muted-bg text-status-muted border-transparent',
			purple:
				'bg-status-purple-bg text-status-purple border-transparent'
		}
	},
	defaultVariants: {
		variant: 'default'
	}
});

export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
