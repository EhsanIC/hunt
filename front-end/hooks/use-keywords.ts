import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createKeyword,
  deleteKeyword,
  getKeywords,
  setKeywordActive,
} from "@/lib/job-hunt-api"

export function useKeywords() {
  return useQuery({ queryKey: ["keywords"], queryFn: getKeywords })
}

export function useAddKeyword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createKeyword,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["keywords"] }),
  })
}

export function useDeleteKeyword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteKeyword,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["keywords"] }),
  })
}

export function useSetKeywordActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      setKeywordActive(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["keywords"] }),
  })
}
