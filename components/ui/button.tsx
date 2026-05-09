import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

type ButtonVariant = 'default' | 'ghost' | 'outline' | 'secondary'
type ButtonSize = 'sm' | 'md' | 'icon'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean
  variant?: ButtonVariant
  size?: ButtonSize
}

const variants: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  outline: 'border border-border bg-card hover:bg-muted',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[11px]',
  md: 'h-8 px-3 text-xs',
  icon: 'h-7 w-7 p-0',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'
