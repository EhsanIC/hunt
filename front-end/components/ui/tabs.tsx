"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "@/lib/utils"

export function Tabs({ className, ...props }: TabsPrimitive.Root.Props & { className?: string }) {
  return <TabsPrimitive.Root className={cn("flex flex-col gap-3", className)} {...props} />
}

export function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return <TabsPrimitive.List className={cn("inline-flex w-fit items-center rounded-lg bg-muted p-1", className)} {...props} />
}

export function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return <TabsPrimitive.Tab className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors data-active:bg-background data-active:shadow-sm", className)} {...props} />
}

export function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel className={cn("outline-none", className)} {...props} />
}
