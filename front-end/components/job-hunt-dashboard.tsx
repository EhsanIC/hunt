"use client"

import { BriefcaseBusiness, Search } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { KeywordForm } from "@/components/keyword-form"
import { KeywordList } from "@/components/keyword-list"
import { JobsTable } from "@/components/jobs-table"
import { ScrapeButton } from "@/components/scrape-button"

export function JobHuntDashboard() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
        <header className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary p-2 text-primary-foreground"><BriefcaseBusiness className="size-5" /></div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Job Hunt Dashboard</h1>
              <p className="text-sm text-muted-foreground">Track keywords, discover new roles, and manage your applications.</p>
            </div>
          </div>
          <ScrapeButton />
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Search className="size-5" /> Add a keyword</CardTitle>
              <CardDescription>Search terms used by the job scraper.</CardDescription>
            </CardHeader>
            <CardContent><KeywordForm /></CardContent>
          </Card>
          <KeywordList />
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Job opportunities</h2>
              <p className="text-sm text-muted-foreground">All jobs currently stored in your database.</p>
            </div>
          </div>
          <JobsTable />
        </section>
      </div>
    </main>
  )
}
