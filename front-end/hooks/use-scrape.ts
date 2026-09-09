import { useMutation, useQueryClient } from "@tanstack/react-query"
import { scrapeJobs } from "@/lib/job-hunt-api"

export function useScrape() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: scrapeJobs,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  })
}
