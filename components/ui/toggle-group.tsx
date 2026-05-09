import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cn } from '@/lib/utils'

export const ToggleGroup = ToggleGroupPrimitive.Root

export const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      'inline-flex h-7 items-center justify-center border-l border-border px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors first:border-l-0 hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
      className,
    )}
    {...props}
  />
))

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName
