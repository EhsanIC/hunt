"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@/lib/utils"

export function Switch({ className, ...props }: SwitchPrimitive.Root.Props & { className?: string }) {
  return (
    <SwitchPrimitive.Root
      className={cn("relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-muted transition-colors data-checked:bg-primary", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform data-checked:translate-x-4" />
    </SwitchPrimitive.Root>
  )
}
