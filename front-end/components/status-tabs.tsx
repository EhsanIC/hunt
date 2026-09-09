"use client"

import type { JobStatus } from "@/lib/job-hunt-api"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const statuses: Array<{ value: JobStatus; label: string }> = [
  { value: "found", label: "Found" },
  { value: "applied", label: "Applied" },
  { value: "rejected", label: "Rejected" },
]

export function StatusTabs({ status, onStatusChange }: { status: JobStatus; onStatusChange: (status: JobStatus) => void }) {
  return (
    <Tabs value={status} onValueChange={(value) => onStatusChange(value as JobStatus)}>
      <TabsList>
        {statuses.map((item) => <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>)}
      </TabsList>
    </Tabs>
  )
}
