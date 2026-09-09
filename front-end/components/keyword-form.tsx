"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"
import { useAddKeyword } from "@/hooks/use-keywords"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const keywordSchema = z.object({
  text: z.string().trim().min(1, "Enter a keyword to track."),
})

type KeywordFormValues = z.infer<typeof keywordSchema>

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The request failed. Please try again."
}

export function KeywordForm() {
  const mutation = useAddKeyword()
  const form = useForm<KeywordFormValues>({
    resolver: zodResolver(keywordSchema),
    defaultValues: { text: "" },
  })

  function onSubmit(values: KeywordFormValues) {
    mutation.mutate(values.text, {
      onSuccess: (keyword) => {
        form.reset()
        toast.success(`Added “${keyword.text}”`)
      },
      onError: (error) => toast.error("Could not add keyword", { description: errorMessage(error) }),
    })
  }

  return (
    <Form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2 sm:flex-row">
      <div className="flex-1">
        <label htmlFor="keyword" className="sr-only">Keyword</label>
        <Input id="keyword" placeholder="e.g. React developer" aria-invalid={Boolean(form.formState.errors.text)} {...form.register("text")} disabled={mutation.isPending} />
        {form.formState.errors.text && <p className="mt-1 text-xs text-destructive">{form.formState.errors.text.message}</p>}
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
        Add keyword
      </Button>
    </Form>
  )
}
