"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Trash2, Loader2 } from "lucide-react"
import { useDeleteKeyword, useKeywords, useSetKeywordActive } from "@/hooks/use-keywords"
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
import type { Keyword } from "@/lib/job-hunt-api"

function MutationError({ error }: { error: unknown }) {
  return error instanceof Error ? error.message : "The request failed. Please try again."
}

export function KeywordList() {
  const { data, isPending, isError, error } = useKeywords()
  const deleteMutation = useDeleteKeyword()
  const activeMutation = useSetKeywordActive()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    if (isError) {
      toast.error("Unable to load keywords", { description: MutationError({ error }) })
    }
  }, [error, isError])

  if (isPending) {
    return <KeywordListSkeleton />
  }

  if (isError) {
    return <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Unable to load keywords: {MutationError({ error })}</p>
  }

  const keywords = data ?? []

  function handleDelete(keyword: Keyword) {
    setDeletingId(keyword.id)
    deleteMutation.mutate(keyword.id, {
      onSuccess: () => toast.success(`Deleted “${keyword.text}”`),
      onError: (mutationError) => toast.error("Could not delete keyword", { description: MutationError({ error: mutationError }) }),
      onSettled: () => setDeletingId(null),
    })
  }

  function handleActiveChange(keyword: Keyword, active: boolean) {
    activeMutation.mutate(
      { id: keyword.id, active },
      {
        onSuccess: () => toast.success(`${keyword.text} is now ${active ? "active" : "inactive"}`),
        onError: (mutationError) => toast.error("Could not update keyword", { description: MutationError({ error: mutationError }) }),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tracked keywords</CardTitle>
        <CardDescription>Active keywords are included in the next scrape.</CardDescription>
      </CardHeader>
      <CardContent>
        {keywords.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No keywords yet. Add one to start searching.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map((keyword) => (
                  <TableRow key={keyword.id}>
                    <TableCell className="font-medium">{keyword.text}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={keyword.active}
                          disabled={activeMutation.isPending}
                          aria-label={`Set ${keyword.text} ${keyword.active ? "inactive" : "active"}`}
                          onCheckedChange={(active) => handleActiveChange(keyword, active)}
                        />
                        <span className="text-sm text-muted-foreground">{keyword.active ? "Active" : "Inactive"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button variant="ghost" size="icon" aria-label={`Delete ${keyword.text}`} disabled={deletingId === keyword.id} />}>
                          {deletingId === keyword.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete keyword?</AlertDialogTitle>
                            <AlertDialogDescription>This will remove “{keyword.text}” from your tracked keywords.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(keyword)}>Delete</AlertDialogAction>
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

function KeywordListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tracked keywords</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
      </CardContent>
    </Card>
  )
}
