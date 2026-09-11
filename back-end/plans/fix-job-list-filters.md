# Fix: Job List Filters Don't Work — Plan

## Diagnosis (checked 2026-09-11 against jobs.db + live API)

`front-end/components/jobs-table.tsx` has **5 client-side filters** that are technically wired but inoperative:

| UI filter | Field it reads | DB contents (165 rows) | Live API value (react, 30 jobs) | Why filter appears broken |
|---|---|---|---|---|
| Internship | `job.is_internship` | 165 NULL | `properties.isInternship` → 30× `false` | Dropdown has no options; any non-"all" selection hides every row because NULL ≠ true/false |
| Location | `job.location` | 165 NULL | `"تهران"` 28/30 | Dropdown only shows "All locations"; filtering does nothing |
| Experience | `job.experience_level` | 165 NULL | Always NULL (scraper bug) — API uses `properties.requiredRelatedExperienceYears` (0-5), scraper reads `experienceLevel/workExperience` which never exist | Dropdown empty even after fresh scrape |
| Remote | `job.is_remote` | 165 NULL | `properties.isRemote` → 5 true / 25 false | Same NULL problem as internship |
| Status | `job.status` | FOUND/APPLIED ok | — | Only filter that works |

Additional issues:

- **Stale data**: All 165 rows were scraped before current field extraction existed (`raw_data_json` is also NULL). No migration can backfill — needs re-scrape.
- **Missing keyword context**: `JobRead` returns `keyword_id: number` but not `keyword: string`; filter dropdown can't filter by "which search found this job" and row doesn't show it. If you delete the saved search the history is still needed.
- **Hidden columns**: Table only renders `Title | Company | Status | Actions`. The filterable fields (location, remote, internship, experience) are invisible, so user can't tell filters did anything.
- **Experience mapping bug in `scraper.py:_to_search_job`**: `experience_level` is always `None` because it reads keys that don't exist in the API response (`experienceLevel` etc). Real source is `properties.requiredRelatedExperienceYears: int`.
- **No empty-state feedback**: When filters hide everything vs when no options exist, both just show "No jobs match".

## Plan — 3 layers, minimal new DB columns (no `search_*` needed for this fix)

### 1. Backend — make stored data correct and exposed

**A. `back-end/scraper.py`** — fix experience extraction (1 line change + helper).
```py
def _format_experience(years: int | None) -> str | None:
    if years is None: return None
    if years == 0: return "No experience"
    return f"{years} year{'s' if years != 1 else ''}"

# inside _to_search_job, after properties = post.get("properties") or {}:
exp_years = properties.get("requiredRelatedExperienceYears") if isinstance(properties.get("requiredRelatedExperienceYears"), int) else None

"experience_level": _first_text(post.get("experienceLevel"), ...) or _format_experience(exp_years),
```
Effect: Next scrape produces `"No experience" | "1 year" | "3 years"` instead of NULL.

**B. `back-end/db/models.py`** — expand `JobRead` to what filters/UI need (no new table columns):
```py
class JobRead(SQLModel):
    id, keyword_id, title, company, url, source_site, found_at, status
    keyword: str | None = None          # denormalized text for UI (not keyword_id)
    is_internship: bool | None = None
    location: str | None = None
    experience_level: str | None = None
    is_remote: bool | None = None
    work_type: str | None = None        # e.g. "تمام وقت"
    seniority_level: str | None = None  # e.g. "کارشناس"
```
All are already columns on `Job`; we just stop hiding them.

**C. `back-end/main.py:GET /jobs`** — enrich with keyword text so frontend can filter/display by keyword without a second fetch:
```py
jobs = session.exec(query).all()
kw_ids = {j.keyword_id for j in jobs}
kw_map = {k.id: k.text for k in session.exec(select(Keyword).where(Keyword.id.in_(kw_ids)))}
return [JobRead(..., keyword=kw_map.get(j.keyword_id), work_type=j.work_type, seniority_level=j.seniority_level, ... ) for j in jobs]
```

### 2. Frontend — make filters match real data and be visible

**D. `front-end/lib/job-hunt-api.ts`** — extend `Job` type to match new `JobRead`:
```ts
keyword?: string | null; work_type?: string | null; seniority_level?: string | null;
```

**E. `front-end/components/jobs-table.tsx`** (no new deps):
- Add `keywordFilter` state + dropdown (options built from `jobs.map(j=>j.keyword)` distinct, like location/experience).
- Add "Unknown" bucket: if N rows have `location == null`, include option `"Unknown"` that matches null rows (`job.location ?? "Unknown"`).
- Fix null handling for booleans:
  ```ts
  const matchesRemote = remoteFilter === "all"
    || (remoteFilter === "remote" && job.is_remote === true)
    || (remoteFilter === "non-remote" && job.is_remote === false)
    || (remoteFilter === "unknown" && job.is_remote == null)
  ```
  Same for internship. Show count badge or disable filters when only "All" + "Unknown" exist.
- Fix experience filter to also consider null vs real values (now real values will exist after re-scrape).
- Add **visible columns** for the filter fields: `Location | Remote | Keyword | Experience` as lightweight badges under title or extra `<TableHead>` cols so user sees result of filtering.
- Add "Clear all filters" button when any filter ≠ "all" or search term active.
- Empty dropdown UX: if `filterValues.locations.length===0` show `<option disabled>No locations stored yet — scrape again</option>` instead of empty.
- Keep existing client-side filtering (no backend query change); reset `currentPage` on filter change already exists.

### 3. Data — populate fields so filters have something to filter

**F. Refresh stale DB**: `DELETE FROM job;` (keep `keyword`/saved searches) then `POST /scrape` (4 active searches, ~150 jobs). Existing `keyword_id` history preserved, new rows will have location/is_remote/etc populated.

Alternative (non-destructive) + migration-safe: keep old rows but show them under "Unknown" — we will do delete only after user confirms, or auto-backfill by re-scraping and letting dedupe by URL refresh null rows (already handled in `POST /scrape` — existing rows will be refreshed with new field values on next scrape). So simplest: just run one `POST /scrape` after deploying fix — deduped update will fill NULLs.

### 4. Verification checklist

- [ ] `back-end/venv/Scripts/python.exe -m py_compile back-end/{scraper,db/models,main}.py` passes
- [ ] `front-end: bunx tsc --noEmit && bun run lint` passes
- [ ] `sqlite3 jobs.db "select location,is_remote,experience_level from job limit 1"` shows non-null after re-scrape
- [ ] `curl GET /jobs` includes `keyword`, `work_type`, `seniority_level`, `experience_level:"3 years"`
- [ ] UI: location/experience/keyword dropdowns now populated; selecting any filters live-updates counts; "Clear all" works; columns show badges; NULL rows group under "Unknown" not vanish
- [ ] Re-run `POST /scrape` → `skipped_existing` increments, no duplicates, fields stay populated

## Files touched
`back-end/scraper.py`, `back-end/db/models.py`, `back-end/main.py`, `front-end/lib/job-hunt-api.ts`, `front-end/components/jobs-table.tsx` (+ docs)

## What this plan does NOT do
No new `search_*` columns, no DB migration beyond existing auto-migration. If you later need "what filter was used to find this job vs what job is" history, add `search_*` snapshot columns then.
