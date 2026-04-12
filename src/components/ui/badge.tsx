import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Badge/pill following Linear.app spec:
 * - Subtle: rgba(255,255,255,0.05) bg, semi-transparent border
 * - Pill: transparent bg, solid border, full radius
 * - Cycle state variants use domain-specific colors
 */
const badgeVariants = cva(
  'inline-flex items-center text-[10px] font-[510] transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default:
          'rounded-[2px] border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.05)] px-2 py-0 text-[#f7f8f8]',
        pill:
          'rounded-full border border-[#23252a] bg-transparent px-2.5 py-0.5 text-[#d0d6e0]',
        success:
          'rounded-full bg-accent px-2 py-0.5 text-[#f7f8f8]',
        destructive:
          'rounded-[2px] border-transparent bg-destructive px-2 py-0 text-destructive-foreground shadow',
        outline:
          'rounded-[2px] border border-[rgba(255,255,255,0.08)] text-[#d0d6e0] px-2 py-0',
        rising:
          'rounded-[2px] border border-[rgba(113,112,255,0.25)] bg-[rgba(113,112,255,0.10)] px-2 py-0 text-cycle-rising',
        peak:
          'rounded-[2px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] px-2 py-0 text-cycle-peak',
        falling:
          'rounded-[2px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2 py-0 text-cycle-falling',
        trough:
          'rounded-[2px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2 py-0 text-cycle-trough',
        live:
          'rounded-[2px] border border-[rgba(113,112,255,0.25)] bg-[rgba(113,112,255,0.10)] px-2 py-0 text-cycle-rising',
        warning:
          'rounded-[2px] border border-[rgba(255,180,50,0.25)] bg-[rgba(255,180,50,0.08)] px-2 py-0 text-[#ffb432]',
        muted:
          'rounded-[2px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2 py-0 text-[#8a8f98]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
