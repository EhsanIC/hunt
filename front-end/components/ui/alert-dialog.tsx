"use client"

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import { cn } from "@/lib/utils"

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger

export function AlertDialogContent({ className, ...props }: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50" />
      <AlertDialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <AlertDialogPrimitive.Popup
          className={cn("w-full max-w-md rounded-xl border bg-background p-6 shadow-lg", className)}
          {...props}
        />
      </AlertDialogPrimitive.Viewport>
    </AlertDialogPrimitive.Portal>
  )
}

export function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />
}

export function AlertDialogTitle({ className, ...props }: AlertDialogPrimitive.Title.Props) {
  return <AlertDialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />
}

export function AlertDialogDescription({ className, ...props }: AlertDialogPrimitive.Description.Props) {
  return <AlertDialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-6 flex justify-end gap-2", className)} {...props} />
}

export function AlertDialogCancel({ className, ...props }: AlertDialogPrimitive.Close.Props) {
  return <AlertDialogPrimitive.Close className={cn("inline-flex h-8 items-center justify-center rounded-lg border px-3 text-sm hover:bg-muted", className)} {...props} />
}

export function AlertDialogAction({ className, ...props }: AlertDialogPrimitive.Close.Props) {
  return <AlertDialogPrimitive.Close className={cn("inline-flex h-8 items-center justify-center rounded-lg bg-destructive px-3 text-sm text-white hover:bg-destructive/90", className)} {...props} />
}
