import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateJobStatus, type JobStatus } from "@/lib/job-hunt-api"

export function useUpdateJobStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: JobStatus }) =>
      updateJobStatus(id, status),
    onSuccess: (_job, variables) => {
      queryClient.invalidateQueries({ queryKey: ["jobs", variables.status] })
      queryClient.invalidateQueries({ queryKey: ["jobs", "found"] })
      queryClient.invalidateQueries({ queryKey: ["jobs", "applied"] })
      queryClient.invalidateQueries({ queryKey: ["jobs", "rejected"] })
    },
  })
}
