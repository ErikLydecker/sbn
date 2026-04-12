import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Button variants following Linear.app design spec:
 * - ghost: rgba(255,255,255,0.02) bg, semi-transparent border
 * - subtle: rgba(255,255,255,0.04) bg, muted text
 * - brand: #5e6ad2 solid bg, white text (primary CTA only)
 * - destructive: reserved for dangerous actions
 * - link: text-only with underline
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-[510] transition-colors focus-visible:outline-none focus-visible:shadow-[rgba(0,0,0,0.1)_0px_4px_12px] disabled:pointer-events-none disabled:opacity-38 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[rgba(255,255,255,0.02)] text-[#e2e4e7] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.05)]',
        brand:
          'bg-primary text-primary-foreground hover:bg-[#8b8aff] shadow-sm',
        subtle:
          'bg-[rgba(255,255,255,0.04)] text-secondary-foreground hover:bg-[rgba(255,255,255,0.06)]',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-[rgba(255,255,255,0.08)] bg-transparent text-secondary-foreground hover:bg-[rgba(255,255,255,0.03)]',
        ghost:
          'text-secondary-foreground hover:bg-[rgba(255,255,255,0.04)]',
        link:
          'text-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 rounded-[6px]',
        sm: 'h-8 rounded-[6px] px-3 text-xs',
        lg: 'h-10 rounded-[6px] px-6',
        icon: 'h-9 w-9 rounded-[6px]',
        'icon-circle': 'h-9 w-9 rounded-full',
        pill: 'h-7 rounded-full px-3 text-xs',
        toolbar: 'h-7 rounded-[2px] px-2 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
