"use client"

import { Loader2, Play } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useScrape } from "@/hooks/use-scrape"

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The request failed. Please try again."
}

export function ScrapeButton() {
  const mutation = useScrape()

  function handleScrape() {
    mutation.mutate(undefined, {
      onSuccess: (result) => {
        const details = `${result.searches_searched} saved searches run, ${result.new_jobs} new jobs, ${result.skipped_existing} existing jobs skipped.`
        const errors = result.errors.length > 0 ? ` Errors: ${result.errors.join("; ")}` : ""
        toast.success("Scrape complete", { description: `${details}${errors}` })
      },
      onError: (error) => toast.error("Scrape failed", { description: errorMessage(error) }),
    })
  }

  return (
    <Button onClick={handleScrape} disabled={mutation.isPending} size="lg">
      {mutation.isPending ? <Loader2 className="animate-spin" /> : <Play />}
      {mutation.isPending ? "Searching…" : "Scrape jobs"}
    </Button>
  )
}
