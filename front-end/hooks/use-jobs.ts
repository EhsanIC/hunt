import { useQuery } from "@tanstack/react-query"
import { getJobs, type JobStatus } from "@/lib/job-hunt-api"

export function useJobs(status?: JobStatus) {
  return useQuery({
    queryKey: ["jobs", status ?? "all"],
    queryFn: () => getJobs(status),
  })
}
