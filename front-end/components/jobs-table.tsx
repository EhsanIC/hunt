"use client"

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react"
import { Check, ExternalLink, Loader2, Search, X } from "lucide-react"
import { toast } from "sonner"
import { useJobs } from "@/hooks/use-jobs"
import { useUpdateJobStatus } from "@/hooks/use-update-job-status"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Job, JobStatus } from "@/lib/job-hunt-api"

const emptyJobs: Job[] = []
const JOBS_PER_PAGE = 30

const statusLabels: Record<JobStatus, string> = {
  found: "Found",
  applied: "Applied",
  rejected: "Rejected",
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The request failed. Please try again."
}

export function JobsTable() {
  const { data, isPending, isError, error } = useJobs()
  const { mutate, isPending: isUpdating, variables } = useUpdateJobStatus()
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all")
  const [internshipFilter, setInternshipFilter] = useState<"all" | "internship" | "non-internship">("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [experienceFilter, setExperienceFilter] = useState("all")
  const [remoteFilter, setRemoteFilter] = useState<"all" | "remote" | "non-remote">("all")
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const jobs = data ?? emptyJobs
  const filteredJobs = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLocaleLowerCase()

    return jobs.filter((job) => {
      const matchesStatus = statusFilter === "all" || job.status === statusFilter
      const matchesInternship = internshipFilter === "all"
        || (internshipFilter === "internship" && job.is_internship === true)
        || (internshipFilter === "non-internship" && job.is_internship === false)
      const matchesLocation = locationFilter === "all" || job.location === locationFilter
      const matchesExperience = experienceFilter === "all" || job.experience_level === experienceFilter
      const matchesRemote = remoteFilter === "all"
        || (remoteFilter === "remote" && job.is_remote === true)
        || (remoteFilter === "non-remote" && job.is_remote === false)
      const matchesSearch = !normalizedSearch || [job.title, job.company, job.source_site]
        .some((value) => value.toLocaleLowerCase().includes(normalizedSearch))

      return matchesStatus && matchesInternship && matchesLocation && matchesExperience && matchesRemote && matchesSearch
    })
  }, [deferredSearchTerm, experienceFilter, internshipFilter, jobs, locationFilter, remoteFilter, statusFilter])

  const filterValues = useMemo(() => ({
    locations: Array.from(new Set(jobs.map((job) => job.location).filter((value): value is string => Boolean(value)))).sort(),
    experiences: Array.from(new Set(jobs.map((job) => job.experience_level).filter((value): value is string => Boolean(value)))).sort(),
  }), [jobs])
  const pageCount = Math.max(1, Math.ceil(filteredJobs.length / JOBS_PER_PAGE))
  const page = Math.min(currentPage, pageCount)
  const pageStart = (page - 1) * JOBS_PER_PAGE
  const visibleJobs = useMemo(
    () => filteredJobs.slice(pageStart, pageStart + JOBS_PER_PAGE),
    [filteredJobs, pageStart],
  )

  useEffect(() => {
    if (isError) {
      toast.error("Unable to load jobs", { description: errorMessage(error) })
    }
  }, [error, isError])


  const updateStatus = useCallback((job: Job, nextStatus: JobStatus) => {
    mutate(
      { id: job.id, status: nextStatus },
      {
        onSuccess: () => toast.success(`Marked “${job.title}” ${nextStatus}`),
        onError: (mutationError) => toast.error("Could not update job", { description: errorMessage(mutationError) }),
      },
    )
  }, [mutate])

  return (
    <Card>
      <CardHeader className="gap-4">
        <CardTitle>Stored jobs</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search title, company, or source"
              aria-label="Search jobs"
              className="pl-8"
            />
          </div>
          <select
            value={statusFilter}              onChange={(event) => {
                setStatusFilter(event.target.value as JobStatus | "all")
                setCurrentPage(1)
              }}
            aria-label="Filter jobs by status"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All statuses</option>
            <option value="found">Found</option>
            <option value="applied">Applied</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={internshipFilter}
            onChange={(event) => {
              setInternshipFilter(event.target.value as typeof internshipFilter)
              setCurrentPage(1)
            }}
            aria-label="Filter jobs by internship"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All internship types</option>
            <option value="internship">Internship</option>
            <option value="non-internship">Non-internship</option>
          </select>
          <select
            value={locationFilter}
            onChange={(event) => {
              setLocationFilter(event.target.value)
              setCurrentPage(1)
            }}
            aria-label="Filter jobs by location"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All locations</option>
            {filterValues.locations.map((location) => <option key={location} value={location}>{location}</option>)}
          </select>
          <select
            value={experienceFilter}
            onChange={(event) => {
              setExperienceFilter(event.target.value)
              setCurrentPage(1)
            }}
            aria-label="Filter jobs by experience"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All experience levels</option>
            {filterValues.experiences.map((experience) => <option key={experience} value={experience}>{experience}</option>)}
          </select>
          <select
            value={remoteFilter}
            onChange={(event) => {
              setRemoteFilter(event.target.value as typeof remoteFilter)
              setCurrentPage(1)
            }}
            aria-label="Filter jobs by remote status"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All remote options</option>
            <option value="remote">Remote</option>
            <option value="non-remote">Non-remote</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {isPending ? <JobsTableSkeleton /> : isError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Unable to load jobs: {errorMessage(error)}</p>
        ) : jobs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No jobs found in the database.</p>
        ) : filteredJobs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No jobs match the current filters.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleJobs.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      isUpdating={isUpdating && variables?.id === job.id}
                      onUpdateStatus={updateStatus}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            {pageCount > 1 && (
              <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
                <p className="text-sm text-muted-foreground">
                  Showing {pageStart + 1}–{Math.min(pageStart + JOBS_PER_PAGE, filteredJobs.length)} of {filteredJobs.length} matching jobs
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setCurrentPage((page) => page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="min-w-20 text-center text-sm text-muted-foreground">
                    Page {page} of {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === pageCount}
                    onClick={() => setCurrentPage((page) => page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

type JobRowProps = {
  job: Job
  isUpdating: boolean
  onUpdateStatus: (job: Job, nextStatus: JobStatus) => void
}

const JobRow = memo(function JobRow({ job, isUpdating, onUpdateStatus }: JobRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">{job.title}</TableCell>
      <TableCell>{job.company}</TableCell>
      <TableCell>
        <span className="rounded-full bg-muted px-2 py-1 text-xs">{statusLabels[job.status]}</span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
            aria-label={`Open ${job.title}`}
          >
            <ExternalLink />
          </a>
          {job.status !== "applied" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Mark ${job.title} applied`}
              disabled={isUpdating}
              onClick={() => onUpdateStatus(job, "applied")}
            >
              <Check />
            </Button>
          )}
          {job.status !== "rejected" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Mark ${job.title} rejected`}
              disabled={isUpdating}
              onClick={() => onUpdateStatus(job, "rejected")}
            >
              <X />
            </Button>
          )}
          {isUpdating && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
      </TableCell>
    </TableRow>
  )
})

function JobsTableSkeleton() {
  return <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
}
