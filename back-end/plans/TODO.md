# Job Hunt App — Phase 1 Technical TODO (Job Finder)

Each section = one milestone with a **manual test you run yourself** before moving on.
Do not start a section until the previous one's manual test passes.

Environment confirmed (from `pip list`): `fastapi 0.141.1`, `uvicorn 0.52.4`,
`playwright 1.62.0`, `pydantic 2.13.5`. **Not installed yet:** `sqlmodel` — that's the
first task below.

Decisions locked in:
- ~~No API on target site(s) → scraping via Playwright, not httpx~~ **Updated:** a real
  JSON API was found via DevTools (job search endpoint on the target site) → use
  `httpx` directly against it. Playwright is kept installed as a fallback only, in
  case the API turns out to need a browser session/cookies to work.
- Keywords are a managed list (add/remove), not a one-off search box
- Database: SQL (SQLite to start) — job data is simple/relational, no need for MongoDB
- No login/auth required (job ads are public)

---

## 1. Project Skeleton
**Tasks:**
- [x] Create venv, install fastapi, uvicorn, playwright, httpx
- [x] Create `main.py` with a health-check route
- [X] `pip install sqlmodel`
- [x] Folder structure: `main.py`, `scraper.py`, `db/models.py`, `db/database.py`
      (database-related files grouped in a `db/` package)

**Manual test:**
1. `uvicorn main:app --reload`
2. Open `http://127.0.0.1:8000/docs` in a browser
3. Confirm `pip show sqlmodel` returns a version (proves the install worked)

**Pass = **/docs** loads with your health-check route listed, and sqlmodel shows installed.**

---

## 2. Database Schema
**Tasks:**
- [x] Define `Keyword` table: id, text, active (bool), created_at
- [x] Define `Job` table: id, keyword_id (FK), title, company, url, source_site,
      found_at, status (enum: found / applied / rejected)
- [x] Set up SQLite file + SQLModel engine in `database.py`
- [x] Create tables on app startup

**Manual test:**
1. Delete any old `.db` file, then start the app: `uvicorn main:app --reload`
2. Confirm a new `jobs.db` (or whatever you name it) file appears in the folder
3. Inspect it: `sqlite3 jobs.db ".tables"` → should list `keyword` and `job`
4. `sqlite3 jobs.db ".schema job"` → confirm columns match the list above

**Pass = both tables exist with the right columns, verified via `sqlite3` CLI (or DB Browser for SQLite).**

> Done 2026-09-07: passed — `sqlite3` CLI not installed here, so `.tables`/`.schema`
> were verified via Python's built-in `sqlite3` module instead (equivalent output).

---

## 3. Keyword Management (CRUD)
**Tasks:**
- [x] `POST /keywords` — add a keyword
- [x] `GET /keywords` — list all keywords
- [x] `DELETE /keywords/{id}` — remove a keyword
- [x] (optional) `PATCH /keywords/{id}` — toggle active/inactive instead of hard delete

**Manual test:**
1. Via `/docs`, `POST /keywords` with 2–3 real keywords (e.g. `"برنامه‌نویس فرانت‌اند"`)
2. `GET /keywords` → confirm all show up
3. **Restart the app** (`Ctrl+C`, re-run `uvicorn`), then `GET /keywords` again →
   confirm they're still there (proves persistence, not just in-memory)
4. `DELETE /keywords/{id}` on one → `GET /keywords` again → confirm it's gone
5. Cross-check directly in the db: `sqlite3 jobs.db "SELECT * FROM keyword;"`

**Pass = keywords survive a restart, and the DB row count matches what `/docs` shows.**

> Done 2026-09-07: passed — tested via curl/httpx (equivalent to the `/docs` calls).
> Extras added: duplicate keyword → 409, empty/whitespace text → 422, unknown id → 404;
> PATCH toggles with no body, or sets explicitly with `{"active": true/false}`.
> Note: Windows shell mangles Persian text passed to `curl -d` (stored as literal `?`) —
> add Persian keywords via `/docs` (browser sends proper UTF-8), which was verified to
> store correctly (Unicode code points checked in the DB).

---

## 4. Target Site Recon

URL -> https://candidateapi.jobvision.ir/api/v1/JobPost/List
body -> 
{"pageSize":30,"requestedPage":1,"sortBy":1,"lastSeen":"2026-08-23T14:02:41.987","locationWrapper":"mashhad","keyword":"react","searchId":null}

**Tasks:**
- [x] Pick one job site to start with
- [x] Found a real JSON API for job search (via DevTools → Network → XHR/Fetch) —
      no HTML scraping needed for the listing data
- [x] Confirm the API works **without** browser auth/cookies (plain `httpx` call, no session)
- [x] Confirm how the keyword is actually sent (query param vs POST body — check the
      request's Payload/Headers tab)
- [x] Confirm the job posting URL pattern (the API returns `id`, not a direct `url` —
      likely `https://<site>/jobs/{id}/{slug}`, same shape as `company.pageUrl`;
      open one real job and check)
- [x] Note pagination shape: `currentPage`, `pageSize`, and total count field

**Manual test:**
1. Right-click the working API request in DevTools → Copy → Copy as cURL
2. Paste it into a plain terminal (not the browser) and run it → confirm it still
   returns the same JSON with no login/session needed
3. Open a `jobPosts[]` entry's `id` on the live site manually, and confirm the URL
   you land on matches the pattern you noted
4. Change the keyword param/body and re-run the cURL → confirm different results
   come back (proves you found the right parameter, not a cached/default response)

**Pass = the cURL command runs standalone (no cookies needed) and returns different, real job data for different keywords, and you have the confirmed job-URL pattern written down.**

> Done 2026-09-07: passed — verified via `recon_section4.py` (plain `httpx` calls, the
> equivalent of the "Copy as cURL" step). Findings:
> - **No cookies/auth needed:** plain POST with httpx's *default* User-Agent, no cookies,
>   no special headers → `200` with JSON. No Playwright fallback required.
> - **Keyword is a POST body field** (`"keyword": "react"`), not a query param —
>   switching it to `django` returned a completely different result set.
> - **Response envelope:** top-level `{traceId, isSuccess, statusCode, message, data}`;
>   the job list lives at `data.jobPosts[]` (Section 5 must unwrap `data`).
>   Each entry has `id`, `title`, `company.nameFa`, `company.pageUrl` — no `jobUrl` field.
> - **Job URL pattern:** `https://jobvision.ir/jobs/{id}` — the site redirects to the
>   canonical `/jobs/{id}/{slug}` and a wrong/placeholder slug is ignored (redirects to
>   the real one). So build URLs from `id` alone: `https://jobvision.ir/jobs/{id}`.
>   Verified live: id `1485541` → real posting, title "استخدام Front-End Developer در دان".
> - **Pagination:** request sends `requestedPage` + `pageSize`; response `data` echoes
>   `currentPage`, `pageSize`, and the total `jobPostCount` (16 for react/mashhad).
>   Out-of-range pages just return an empty `jobPosts[]`. Loop cap: while collected
>   `< jobPostCount`, increment `requestedPage`.

---

## 5. Standalone Scraper Script
**Tasks:**
- [x] Write `scraper.py` as a plain script (not inside FastAPI yet)
- [x] Use `httpx` to call the job search API directly with a keyword param
- [x] Parse the JSON response into a list of dicts: `title`, `company` (`.nameFa`),
      `url` (built from `id` using the pattern confirmed in Section 4), plus
      `source_site`
- [x] Handle pagination: loop `currentPage` until you've pulled all pages (or a
      sane cap, e.g. first 5 pages) using the total count field from the response
- [x] Function signature: `search_jobs(keyword: str) -> list[dict]`
- [x] Run via `python scraper.py` with a test keyword, print results
- [ ] **Fallback plan (only if httpx gets blocked):** if the plain `httpx` call
      returns errors/empty data that the browser call didn't, keep a Playwright
      version in reserve — same function signature, swapped implementation, so the
      rest of the app doesn't need to change

**Manual test:**
1. Run `python scraper.py` with a test keyword — confirm it prints results with
   **no browser window opening** (this alone proves httpx is enough, no Playwright needed)
2. Check the printed output: at least 5 real, distinct jobs with non-empty `title`,
   `company`, `url`
3. Manually open 2 of the printed `url`s in a normal browser tab → confirm they load
   the actual posting (not a 404 or generic search/company page)
4. Run it again with a **different** keyword → confirm the results actually change
   (catches any silent fallback to cached/default data)

**Pass = printed list of real jobs with zero browser automation involved, and their URLs actually resolve to real postings when clicked.**

> Done 2026-09-07: passed — `python scraper.py react` printed 16 real jobs
> (matches recon's `jobPostCount: 16`), all with non-empty title/company/url,
> no browser involved. `python scraper.py django` returned a completely
> different set (4 jobs) — results really do follow the keyword.
> Implementation notes:
> - Pagination stops on an empty page, when collected >= `jobPostCount`, or at
>   the 5-page cap; 1s delay between page requests.
> - Results deduped by url within a run (Section 6 dedupes against the DB).
> - URL pattern pre-verified in Section 4 recon (id 1485541 → real posting),
>   and the same id appears as result #1 here.
> - `lastSeen` stays at its capture-time value; API still returns current
>   listings with it.
> - Fallback plan NOT triggered — plain httpx worked throughout.

---

## 6. Scraper + Database + Keywords, Wired Together
**Tasks:**
- [x] Convert scraper to async (`httpx.AsyncClient`) — no browser lifecycle to manage,
      since Playwright is no longer in the request path
- [x] Add a reasonable delay/rate-limit between requests per keyword, since you're
      calling the API directly now (be a good citizen — no browser overhead means
      it's easy to accidentally hammer the endpoint)
- [x] Add `POST /scrape` (or a scheduled/background job) that: loops over all active
      keywords → calls `search_jobs()` for each → saves new jobs to the `Job` table
      with status "found" → skips jobs already stored (dedupe by url)
- [ ] (Only if Section 5's fallback plan was triggered) launch the Playwright browser
      once at app startup via `lifespan`, and switch it to `headless=True` once confirmed working

**Manual test:**
1. Make sure you have 2+ active keywords (from Section 3)
2. Trigger `POST /scrape` via `/docs`
3. `sqlite3 jobs.db "SELECT keyword_id, COUNT(*) FROM job GROUP BY keyword_id;"` →
   confirm jobs landed under the right keywords
4. Run `POST /scrape` **a second time immediately** → re-run the same query →
   row counts should **not** double (proves dedupe by url works)
5. Time the request (e.g. via `/docs` response time, or a `print` timestamp) — it
   should complete much faster than a Playwright-based scrape would have

**Pass = jobs appear per-keyword in the DB, re-scraping doesn't create duplicates, and the scrape completes quickly with no browser involved.**

> Done 2026-09-07: passed — 4 active keywords (`python developer`, `django`,
> `برنامه‌نویس فرانت‌اند`, `testing`).
> - First `POST /scrape`: 10.6s, `keywords_searched: 4, new_jobs: 53,
>   skipped_existing: 0, errors: []`. DB check: 53 rows, 53 distinct urls,
>   grouped per keyword (17/29/7 — the 3 keywords that returned results;
>   `testing` had no matches).
> - Second `POST /scrape` immediately after: 10.3s, `new_jobs: 0,
>   skipped_existing: 53` — row count unchanged, dedupe by url works.
> - No browser involved; ~10s for 4 keywords is dominated by the 1s politeness
>   delays between keywords and between result pages.
> Implementation notes:
> - `search_jobs(client, keyword)` is now async and takes a shared
>   `httpx.AsyncClient` (connection pooling across keywords); CLI runner wraps
>   it in its own client, so `python scraper.py react` still works standalone.
> - `/scrape` dedupes against the DB by url AND within a single run (a job
>   matching two keywords is stored once, under the first keyword that found it).
> - Per-keyword failures are caught and reported in the response's `errors`
>   list; one bad keyword doesn't abort the run.
> - The `/recon/section4` route and its import were removed from `main.py`
>   (recon is done; `recon_section4.py` still runs standalone).

---

## 7. Viewing & Status Updates
**Tasks:**
- [x] `GET /jobs` — list jobs, filterable by status (found / applied / rejected)
- [x] `PATCH /jobs/{id}` — update a job's status (mark as applied or rejected)
- [x] Response includes the job's `url` so you can click through to the real posting

**Manual test:**
1. `GET /jobs?status=found` → confirm only unactioned jobs show, and each has a clickable `url`
2. Pick one job's `id`, click its `url` → confirm it opens the real posting
3. `PATCH /jobs/{id}` → set status to `applied`
4. `GET /jobs?status=found` again → that job is gone from the list
5. `GET /jobs?status=applied` → that job now shows up here instead
6. Restart the app → repeat step 5 → confirm the status stuck (persistence check)

**Pass = filtering by status works correctly, and status changes survive a restart.**

> Done 2026-09-07: passed — `GET /jobs?status=found` returned all 53 jobs with
> real jobvision URLs; PATCH job 1 → applied, job 2 → rejected; afterwards
> `found` had 51 (both gone), `applied` = [1], `rejected` = [2].
> Server restarted → applied/rejected still exactly as left (persistence OK).
> Edge cases: `?status=nonsense` → 422 (FastAPI validates the enum), PATCH
> unknown id → 404, PATCH with invalid status body → 422.
> Implementation notes: `JobRead`/`JobUpdate` schemas added to `db/models.py`
> (`JobUpdate.status` is the `JobStatus` enum, so bad values are rejected by
> validation); `/jobs` filter is optional — no param returns all jobs.

---

## 8. Minimal Viewing Layer
**Tasks:**
- [ ] Decide: plain `/docs` Swagger UI (fine short-term) vs. a simple HTML/Next.js page
- [ ] Build just enough to: manage keywords, trigger a scrape, browse jobs by status,
      click through to real postings, update status

**Manual test:**
1. Without opening a terminal for anything other than starting the server, complete a
   full loop using only the UI (Swagger or your simple page):
   - Add a keyword
   - Trigger a scrape
   - See new jobs appear, filtered by "found"
   - Click through to one real posting
   - Mark it "applied"
   - Confirm the "found" list no longer shows it

**Pass = you can do the entire day-to-day loop above without hand-writing `curl`/SQL commands.**

---

## Phase 1 Definition of Done
Manage a list of keywords → trigger a scrape → see a deduplicated list of real jobs
per keyword, stored in the database → click through to apply manually → mark each
job's status (applied / rejected) and have it persist.

**Full end-to-end manual test (run once all 8 sections pass):**
1. Fresh `jobs.db` (delete existing one)
2. Add 3 keywords via UI
3. Trigger scrape once → confirm jobs saved
4. Trigger scrape again → confirm no duplicates
5. Mark 1 job applied, 1 rejected
6. Restart app entirely
7. Confirm keywords, jobs, and statuses are all still exactly as left