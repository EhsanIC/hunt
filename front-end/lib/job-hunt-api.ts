import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api"

export type Keyword = {
  id: number
  text: string
  active: boolean
  created_at: string
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
  keywords_searched: number
  new_jobs: number
  skipped_existing: number
  errors: string[]
  message?: string
}

export function getKeywords() {
  return apiGet<Keyword[]>("/keywords")
}

export function createKeyword(text: string) {
  return apiPost<Keyword>("/keywords", { text })
}

export function deleteKeyword(id: number) {
  return apiDelete(`/keywords/${id}`)
}

export function setKeywordActive(id: number, active: boolean) {
  return apiPatch<Keyword>(`/keywords/${id}`, { active })
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
