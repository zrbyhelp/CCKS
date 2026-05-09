import * as React from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'danger'

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant
}

const variants: Record<BadgeVariant, string> = {
  default: 'border-transparent bg-primary/15 text-primary',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  outline: 'border-border bg-card text-muted-foreground',
  danger: 'border-transparent bg-red-500/12 text-red-600',
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded px-1.5 text-[10px] font-black leading-none',
        'border',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
