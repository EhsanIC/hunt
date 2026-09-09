"use client"

import { ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { SearchJob } from "@/lib/job-hunt-api"

export function SearchResults({ jobs, total }: { jobs: SearchJob[]; total: number | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom search results{total !== null ? ` · ${total} total` : ""}</CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No jobs matched these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.title}</TableCell>
                    <TableCell>{job.company}</TableCell>
                    <TableCell>{job.location ?? "—"}</TableCell>
                    <TableCell>{job.work_type ?? (job.is_remote ? "Remote" : "—")}</TableCell>
                    <TableCell className="text-right">
                      <a href={job.url} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))} aria-label={`Open ${job.title}`}>
                        <ExternalLink />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
