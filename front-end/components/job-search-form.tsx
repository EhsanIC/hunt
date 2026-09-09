"use client"

import { useForm, useWatch } from "react-hook-form"
import { Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useSearchJobs } from "@/hooks/use-search-jobs"
import type { SearchFilters, SearchJob } from "@/lib/job-hunt-api"

type FormValues = {
  keyword: string
  locationWrapper: string
  jobCategoryUrlTitle: string
  workExperiences: string
  isRemote: boolean
  isInternship: boolean
  sortBy: string
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The request failed. Please try again."
}

export function JobSearchForm({ onResults }: { onResults: (jobs: SearchJob[], count: number) => void }) {
  const mutation = useSearchJobs()
  const form = useForm<FormValues>({
    defaultValues: {
      keyword: "",
      locationWrapper: "",
      jobCategoryUrlTitle: "",
      workExperiences: "",
      isRemote: false,
      isInternship: false,
      sortBy: "1",
    },
  })
  const isRemote = useWatch({ control: form.control, name: "isRemote" })
  const isInternship = useWatch({ control: form.control, name: "isInternship" })

  function onSubmit(values: FormValues) {
    const experienceValues = values.workExperiences
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map(Number)
      .filter((value) => Number.isInteger(value))

    const filters: SearchFilters = {
      keyword: values.keyword.trim() || undefined,
      locationWrapper: values.locationWrapper.trim() || undefined,
      jobCategoryUrlTitle: values.jobCategoryUrlTitle.trim() || undefined,
      workExperiences: experienceValues.length ? experienceValues : undefined,
      isRemote: values.isRemote ? true : undefined,
      isInternship: values.isInternship ? true : undefined,
      sortBy: Number(values.sortBy),
    }

    mutation.mutate(filters, {
      onSuccess: (result) => {
        onResults(result.jobs, result.jobPostCount)
        toast.success(`${result.jobPostCount} matching job(s) found`)
      },
      onError: (error) => toast.error("JobVision search failed", { description: errorMessage(error) }),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom JobVision search</CardTitle>
        <CardDescription>Filters are sent to JobVision&apos;s JobPost/List API body, not inferred from the URL.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="search-keyword" className="text-sm font-medium">Keyword</label>
            <Input id="search-keyword" placeholder="react" {...form.register("keyword")} />
          </div>
          <div>
            <label htmlFor="search-location" className="text-sm font-medium">Location slug</label>
            <Input id="search-location" placeholder="mashhad" {...form.register("locationWrapper")} />
          </div>
          <div>
            <label htmlFor="search-category" className="text-sm font-medium">Category slug</label>
            <Input id="search-category" placeholder="developer" {...form.register("jobCategoryUrlTitle")} />
          </div>
          <div>
            <label htmlFor="search-experience" className="text-sm font-medium">Experience IDs</label>
            <Input id="search-experience" placeholder="-1,1,2" {...form.register("workExperiences")} />
            <p className="mt-1 text-xs text-muted-foreground">Use IDs returned by JobVision, such as -1 for no experience.</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="search-remote" checked={isRemote} onCheckedChange={(checked) => form.setValue("isRemote", checked)} />
            <label htmlFor="search-remote" className="text-sm">Remote only</label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="search-internship" checked={isInternship} onCheckedChange={(checked) => form.setValue("isInternship", checked)} />
            <label htmlFor="search-internship" className="text-sm">Internship only</label>
          </div>
          <div>
            <label htmlFor="search-sort" className="text-sm font-medium">Sort ID</label>
            <Input id="search-sort" type="number" {...form.register("sortBy")} />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={mutation.isPending}>
              <Search />
              {mutation.isPending ? "Searching…" : "Search jobs"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
