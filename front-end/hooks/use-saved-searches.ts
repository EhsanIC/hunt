import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  deleteSavedSearch,
  getSavedSearches,
  saveSearch,
  setSavedSearchActive,
  type SearchFilters,
} from "@/lib/job-hunt-api"

export function useSavedSearches() {
  return useQuery({ queryKey: ["saved-searches"], queryFn: getSavedSearches })
}

export function useSaveSearch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (filters: SearchFilters) => saveSearch(filters),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-searches"] }),
  })
}

export function useDeleteSavedSearch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteSavedSearch,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-searches"] }),
  })
}

export function useSetSavedSearchActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      setSavedSearchActive(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-searches"] }),
  })
}
