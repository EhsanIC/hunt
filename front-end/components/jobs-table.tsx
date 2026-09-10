"use client"

import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { Check, ExternalLink, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { useJobs } from "@/hooks/use-jobs"
import { useUpdateJobStatus } from "@/hooks/use-update-job-status"
import { Button, buttonVariants } from "@/components/ui/button"
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
  const jobs = data ?? emptyJobs
  const pageCount = Math.max(1, Math.ceil(jobs.length / JOBS_PER_PAGE))
  const page = Math.min(currentPage, pageCount)
  const pageStart = (page - 1) * JOBS_PER_PAGE
  const visibleJobs = useMemo(
    () => jobs.slice(pageStart, pageStart + JOBS_PER_PAGE),
    [jobs, pageStart],
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
      <CardHeader>
        <CardTitle>Stored jobs</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending ? <JobsTableSkeleton /> : isError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Unable to load jobs: {errorMessage(error)}</p>
        ) : jobs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No jobs found in the database.</p>
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
                  Showing {pageStart + 1}–{Math.min(pageStart + JOBS_PER_PAGE, jobs.length)} of {jobs.length} jobs
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
