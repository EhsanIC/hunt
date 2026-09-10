"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { flexRender, tableFeatures, useTable } from "@tanstack/react-table"
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

const features = tableFeatures({})
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
  const mutation = useUpdateJobStatus()
  const [currentPage, setCurrentPage] = useState(1)
  const jobs = data ?? emptyJobs
  const pageCount = Math.max(1, Math.ceil(jobs.length / JOBS_PER_PAGE))
  const page = Math.min(currentPage, pageCount)
  const pageStart = (page - 1) * JOBS_PER_PAGE
  const visibleJobs = jobs.slice(pageStart, pageStart + JOBS_PER_PAGE)

  useEffect(() => {
    if (isError) {
      toast.error("Unable to load jobs", { description: errorMessage(error) })
    }
  }, [error, isError])

  const updateStatus = useCallback((job: Job, nextStatus: JobStatus) => {
    mutation.mutate(
      { id: job.id, status: nextStatus },
      {
        onSuccess: () => toast.success(`Marked “${job.title}” ${nextStatus}`),
        onError: (mutationError) => toast.error("Could not update job", { description: errorMessage(mutationError) }),
      },
    )
  }, [mutation])

  const columns = useMemo(() => [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }: { row: { original: Job } }) => <span className="font-medium">{row.original.title}</span>,
    },
    {
      accessorKey: "company",
      header: "Company",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: { row: { original: Job } }) => <span className="rounded-full bg-muted px-2 py-1 text-xs">{statusLabels[row.original.status]}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }: { row: { original: Job } }) => {
        const job = row.original
        const isUpdating = mutation.isPending && mutation.variables?.id === job.id
        return (
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
            {job.status !== "applied" && <Button variant="ghost" size="icon-sm" aria-label={`Mark ${job.title} applied`} disabled={isUpdating} onClick={() => updateStatus(job, "applied")}><Check /></Button>}
            {job.status !== "rejected" && <Button variant="ghost" size="icon-sm" aria-label={`Mark ${job.title} rejected`} disabled={isUpdating} onClick={() => updateStatus(job, "rejected")}><X /></Button>}
            {isUpdating && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
        )
      },
    },
  ], [mutation, updateStatus])

  const table = useTable({
    features,
    columns,
    data: visibleJobs,
  })

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
                  {table.getHeaderGroups().map((headerGroup) => <TableRow key={headerGroup.id}>{headerGroup.headers.map((header) => <TableHead key={header.id} className={header.column.id === "actions" ? "text-right" : undefined}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>)}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => <TableRow key={row.id}>{row.getAllCells().map((cell) => <TableCell key={cell.id} className={cell.column.id === "actions" ? "text-right" : undefined}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}
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

function JobsTableSkeleton() {
  return <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
}
