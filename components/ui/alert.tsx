import * as React from 'react'
import { cn } from '@/lib/utils'

type AlertVariant = 'default' | 'destructive'

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant
}

const alertVariants: Record<AlertVariant, string> = {
  default: 'border-border bg-card text-card-foreground',
  destructive: 'border-[#ffd8c4] bg-[#fff7f2] text-[#9a3412]',
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn('relative w-full rounded-md border px-3 py-2 text-xs shadow-lg', alertVariants[variant], className)}
      {...props}
    />
  ),
)

Alert.displayName = 'Alert'

export const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('mb-0.5 text-xs font-black leading-none tracking-normal', className)} {...props} />
  ),
)

AlertTitle.displayName = 'AlertTitle'

export const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-[11px] leading-4 opacity-90', className)} {...props} />
  ),
)

AlertDescription.displayName = 'AlertDescription'
