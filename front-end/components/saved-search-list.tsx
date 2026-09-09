"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Trash2, Loader2 } from "lucide-react"
import { useDeleteSavedSearch, useSavedSearches, useSetSavedSearchActive } from "@/hooks/use-saved-searches"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { SavedSearch } from "@/lib/job-hunt-api"

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The request failed. Please try again."
}

function searchSummary(search: SavedSearch) {
  const filters = search.filters
  const parts = [filters.locationWrapper, filters.jobCategoryUrlTitle]
    .filter(Boolean)
    .join(" · ")
  const flags = [filters.isRemote && "Remote", filters.isInternship && "Internship"]
    .filter(Boolean)
    .join(" · ")
  return [parts, filters.workExperiences?.join(", "), flags].filter(Boolean).join(" · ") || "All locations and categories"
}

export function SavedSearchList() {
  const { data, isPending, isError, error } = useSavedSearches()
  const deleteMutation = useDeleteSavedSearch()
  const activeMutation = useSetSavedSearchActive()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    if (isError) {
      toast.error("Unable to load saved searches", { description: errorMessage(error) })
    }
  }, [error, isError])

  if (isPending) return <SavedSearchListSkeleton />
  if (isError) {
    return <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Unable to load saved searches: {errorMessage(error)}</p>
  }

  const searches = data ?? []

  function handleDelete(search: SavedSearch) {
    setDeletingId(search.id)
    deleteMutation.mutate(search.id, {
      onSuccess: () => toast.success(`Deleted “${search.text}” search`),
      onError: (mutationError) => toast.error("Could not delete saved search", { description: errorMessage(mutationError) }),
      onSettled: () => setDeletingId(null),
    })
  }

  function handleActiveChange(search: SavedSearch, active: boolean) {
    activeMutation.mutate(
      { id: search.id, active },
      {
        onSuccess: () => toast.success(`${search.text} is now ${active ? "active" : "inactive"}`),
        onError: (mutationError) => toast.error("Could not update saved search", { description: errorMessage(mutationError) }),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved JobVision searches</CardTitle>
        <CardDescription>Active searches are included in the next scrape.</CardDescription>
      </CardHeader>
      <CardContent>
        {searches.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No saved searches yet. Run a custom search and save it.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Search</TableHead>
                  <TableHead>Filters</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searches.map((search) => (
                  <TableRow key={search.id}>
                    <TableCell className="font-medium">{search.text}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{searchSummary(search)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={search.active}
                          disabled={activeMutation.isPending}
                          aria-label={`Set ${search.text} ${search.active ? "inactive" : "active"}`}
                          onCheckedChange={(active) => handleActiveChange(search, active)}
                        />
                        <span className="text-sm text-muted-foreground">{search.active ? "Active" : "Inactive"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button variant="ghost" size="icon" aria-label={`Delete ${search.text}`} disabled={deletingId === search.id} />}>
                          {deletingId === search.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete saved search?</AlertDialogTitle>
                            <AlertDialogDescription>This will remove “{search.text}” from your scheduled searches. Existing jobs are kept.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(search)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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

function SavedSearchListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved JobVision searches</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
      </CardContent>
    </Card>
  )
}
