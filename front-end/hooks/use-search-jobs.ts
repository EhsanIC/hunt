import { useMutation } from "@tanstack/react-query"
import { searchJobs, type SearchFilters } from "@/lib/job-hunt-api"

export function useSearchJobs() {
  return useMutation({
    mutationFn: (filters: SearchFilters) => searchJobs(filters),
  })
}
