import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api"

export type SavedSearch = {
  id: number
  text: string
  active: boolean
  created_at: string
  filters: SearchFilters
}

export type JobStatus = "found" | "applied" | "rejected"

export type Job = {
  id: number
  keyword_id: number
  title: string
  company: string
  url: string
  source_site: string
  found_at: string
  status: JobStatus
  is_internship?: boolean | null
  location?: string | null
  experience_level?: string | null
  is_remote?: boolean | null
}

export type SearchFilters = {
  pageSize?: number
  sortBy?: number
  keyword?: string
  locationWrapper?: string
  jobCategoryUrlTitle?: string
  workExperiences?: number[]
  isRemote?: boolean
  isInternship?: boolean
  searchId?: string | null
  maxPages?: number
}

export type SearchJob = {
  id: number
  title: string
  company: string
  url: string
  source_site: string
  is_remote?: boolean | null
  is_internship?: boolean | null
  location?: string | null
  experience_level?: string | null
  work_type?: string | null
  seniority_level?: string | null
}

export type SearchResponse = {
  currentPage: number
  pageSize: number
  jobPostCount: number
  searchId?: string | null
  hasSalaryHistogram?: boolean | null
  jobs: SearchJob[]
}

export type ScrapeResult = {
  searches_searched: number
  new_jobs: number
  skipped_existing: number
  errors: string[]
  message?: string
}

export function getSavedSearches() {
  return apiGet<SavedSearch[]>("/saved-searches")
}

export function saveSearch(filters: SearchFilters) {
  return apiPost<SavedSearch>("/saved-searches", filters)
}

export function deleteSavedSearch(id: number) {
  return apiDelete(`/saved-searches/${id}`)
}

export function setSavedSearchActive(id: number, active: boolean) {
  return apiPatch<SavedSearch>(`/saved-searches/${id}`, { active })
}

export function getJobs(status?: JobStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ""
  return apiGet<Job[]>(`/jobs${query}`)
}

export function searchJobs(filters: SearchFilters) {
  return apiPost<SearchResponse>("/search", filters)
}

export function scrapeJobs() {
  return apiPost<ScrapeResult>("/scrape")
}

export function updateJobStatus(id: number, status: JobStatus) {
  return apiPatch<Job>(`/jobs/${id}`, { status })
}
