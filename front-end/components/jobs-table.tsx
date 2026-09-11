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
const UNKNOWN = "__unknown__"

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
  const [internshipFilter, setInternshipFilter] = useState<"all" | "internship" | "non-internship" | "unknown">("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [experienceFilter, setExperienceFilter] = useState("all")
  const [remoteFilter, setRemoteFilter] = useState<"all" | "remote" | "non-remote" | "unknown">("all")
  const [keywordFilter, setKeywordFilter] = useState("all")
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const jobs = data ?? emptyJobs

  const filterValues = useMemo(() => {
    const kw = Array.from(new Set(jobs.map((job) => job.keyword ?? UNKNOWN)))
    const loc = Array.from(new Set(jobs.map((job) => job.location ?? UNKNOWN)))
    const exp = Array.from(new Set(jobs.map((job) => job.experience_level ?? UNKNOWN)))
    const sortWithUnknownLast = (a: string, b: string) => {
      if (a === UNKNOWN) return 1
      if (b === UNKNOWN) return -1
      return a.localeCompare(b, "fa")
    }
    return {
      keywords: kw.sort(sortWithUnknownLast),
      locations: loc.sort(sortWithUnknownLast),
      experiences: exp.sort(sortWithUnknownLast),
    }
  }, [jobs])

  const hasActiveFilters =
    statusFilter !== "all" ||
    internshipFilter !== "all" ||
    locationFilter !== "all" ||
    experienceFilter !== "all" ||
    remoteFilter !== "all" ||
    keywordFilter !== "all" ||
    deferredSearchTerm.trim() !== ""

  const filteredJobs = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLocaleLowerCase()

    return jobs.filter((job) => {
      const matchesStatus = statusFilter === "all" || job.status === statusFilter
      const matchesKeyword = keywordFilter === "all" || (job.keyword ?? UNKNOWN) === keywordFilter
      const matchesInternship =
        internshipFilter === "all" ||
        (internshipFilter === "internship" && job.is_internship === true) ||
        (internshipFilter === "non-internship" && job.is_internship === false) ||
        (internshipFilter === "unknown" && job.is_internship == null)
      const jobLocationKey = job.location ?? UNKNOWN
      const matchesLocation = locationFilter === "all" || jobLocationKey === locationFilter
      const jobExpKey = job.experience_level ?? UNKNOWN
      const matchesExperience = experienceFilter === "all" || jobExpKey === experienceFilter
      const matchesRemote =
        remoteFilter === "all" ||
        (remoteFilter === "remote" && job.is_remote === true) ||
        (remoteFilter === "non-remote" && job.is_remote === false) ||
        (remoteFilter === "unknown" && job.is_remote == null)
      const matchesSearch =
        !normalizedSearch ||
        [job.title, job.company, job.source_site, job.keyword ?? "", job.location ?? "", job.experience_level ?? ""]
          .some((value) => value.toLocaleLowerCase().includes(normalizedSearch))

      return matchesStatus && matchesKeyword && matchesInternship && matchesLocation && matchesExperience && matchesRemote && matchesSearch
    })
  }, [deferredSearchTerm, experienceFilter, internshipFilter, jobs, keywordFilter, locationFilter, remoteFilter, statusFilter])

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

  const clearAllFilters = useCallback(() => {
    setSearchTerm("")
    setStatusFilter("all")
    setInternshipFilter("all")
    setLocationFilter("all")
    setExperienceFilter("all")
    setRemoteFilter("all")
    setKeywordFilter("all")
    setCurrentPage(1)
  }, [])

  const updateStatus = useCallback(
    (job: Job, nextStatus: JobStatus) => {
      mutate(
        { id: job.id, status: nextStatus },
        {
          onSuccess: () => toast.success(`Marked “${job.title}” ${nextStatus}`),
          onError: (mutationError) => toast.error("Could not update job", { description: errorMessage(mutationError) }),
        },
      )
    },
    [mutate],
  )

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Stored jobs</CardTitle>
          {hasActiveFilters && jobs.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllFilters} className="w-fit">
              <X className="size-3.5" /> Clear filters
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-[240px]">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search title, company, source, keyword…"
              aria-label="Search jobs"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => {
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
            value={keywordFilter}
            onChange={(event) => {
              setKeywordFilter(event.target.value)
              setCurrentPage(1)
            }}
            aria-label="Filter jobs by keyword"
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All keywords</option>
            {filterValues.keywords.map((kw) => (
              <option key={kw} value={kw}>
                {kw === UNKNOWN ? "Unknown" : kw}
              </option>
            ))}
            {jobs.length > 0 && filterValues.keywords.length === 0 && (
              <option disabled>No keywords stored yet</option>
            )}
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
            <option value="all">All types</option>
            <option value="internship">Internship</option>
            <option value="non-internship">Non-internship</option>
            <option value="unknown">Unknown</option>
          </select>
          <select
            value={locationFilter}
            onChange={(event) => {
              setLocationFilter(event.target.value)
              setCurrentPage(1)
            }}
            aria-label="Filter jobs by location"
            className="h-8 max-w-[180px] rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All locations</option>
            {filterValues.locations.map((location) => (
              <option key={location} value={location}>
                {location === UNKNOWN ? "Unknown" : location}
              </option>
            ))}
            {jobs.length > 0 && filterValues.locations.length === 0 && (
              <option disabled>No locations stored yet — scrape again</option>
            )}
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
            <option value="all">All experience</option>
            {filterValues.experiences.map((experience) => (
              <option key={experience} value={experience}>
                {experience === UNKNOWN ? "Unknown" : experience}
              </option>
            ))}
            {jobs.length > 0 && filterValues.experiences.length === 0 && (
              <option disabled>No experience data yet — scrape again</option>
            )}
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
            <option value="all">All remote</option>
            <option value="remote">Remote</option>
            <option value="non-remote">On-site</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        {jobs.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Showing {filteredJobs.length} of {jobs.length} jobs
            {hasActiveFilters ? " (filtered)" : ""}
            {filterValues.locations.length === 1 && filterValues.locations[0] === UNKNOWN ? " — location/experience empty until you re-scrape" : ""}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {isPending ? (
          <JobsTableSkeleton />
        ) : isError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Unable to load jobs: {errorMessage(error)}
          </p>
        ) : jobs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No jobs found in the database.</p>
        ) : filteredJobs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">No jobs match the current filters.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={clearAllFilters}>
              Clear all filters
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Title</TableHead>
                    <TableHead className="min-w-[140px]">Company</TableHead>
                    <TableHead className="hidden md:table-cell">Keyword</TableHead>
                    <TableHead className="hidden md:table-cell">Location</TableHead>
                    <TableHead className="hidden lg:table-cell">Experience</TableHead>
                    <TableHead className="hidden lg:table-cell">Remote</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleJobs.map((job) => (
                    <JobRow key={job.id} job={job} isUpdating={isUpdating && variables?.id === job.id} onUpdateStatus={updateStatus} />
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
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setCurrentPage((page) => page - 1)}>
                    Previous
                  </Button>
                  <span className="min-w-20 text-center text-sm text-muted-foreground">
                    Page {page} of {pageCount}
                  </span>
                  <Button variant="outline" size="sm" disabled={page === pageCount} onClick={() => setCurrentPage((page) => page + 1)}>
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
  const remoteLabel = job.is_remote === true ? "Remote" : job.is_remote === false ? "On-site" : "—"
  const internLabel = job.is_internship === true ? "Internship" : job.is_internship === false ? "Job" : "—"
  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="max-w-[320px] truncate" title={job.title}>
          {job.title}
        </div>
        <div className="mt-1 flex flex-wrap gap-1 md:hidden">
          {job.keyword && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">{job.keyword}</span>}
          {job.location && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">{job.location}</span>}
          {job.work_type && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] leading-none text-primary">{job.work_type}</span>}
        </div>
      </TableCell>
      <TableCell className="text-sm">{job.company}</TableCell>
      <TableCell className="hidden max-w-[120px] truncate text-sm md:table-cell" title={job.keyword ?? undefined}>
        {job.keyword ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{job.keyword}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="hidden text-sm md:table-cell">
        {job.location ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{job.location}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        {job.seniority_level && (
          <div className="mt-1 text-[11px] leading-none text-muted-foreground">{job.seniority_level}</div>
        )}
      </TableCell>
      <TableCell className="hidden text-sm lg:table-cell">
        {job.experience_level ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{job.experience_level}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        {job.work_type && <div className="mt-1 hidden text-[11px] leading-none text-muted-foreground xl:block">{job.work_type}</div>}
      </TableCell>
      <TableCell className="hidden text-xs lg:table-cell">
        <div className="flex flex-col gap-1">
          <span
            className={cn(
              "w-fit rounded-full px-2 py-0.5 text-xs leading-none",
              job.is_remote === true && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
              job.is_remote === false && "bg-muted text-muted-foreground",
              job.is_remote == null && "bg-muted/50 text-muted-foreground",
            )}
            title={String(job.is_remote)}
          >
            {remoteLabel}
          </span>
          <span className="text-[11px] leading-none text-muted-foreground">{internLabel}</span>
        </div>
      </TableCell>
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
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
