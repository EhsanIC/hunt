# Job Hunt App — Plan

## Phase 1 (current scope): Job Finder

**Goal:** A personal tool that searches Persian job sites for a keyword and gives a clean,
browsable list of matching jobs — so there's no need to manually check multiple sites
every day.

### What it does
1. Enter a keyword (e.g. "برنامه‌نویس فرانت‌اند")
2. The app searches the job site(s) for that keyword, the same way a person would manually
3. It pulls back the list of matching jobs — title, company, maybe location/date — and
   shows them in one place
4. Browse the list, and for anything interesting, open the actual job posting on the
   real website
5. Apply / send resume manually, directly on that site, as usual

### What it does NOT do (yet)
- No AI resume tailoring
- No auto-submission of applications
- No tracking of what's been applied to

These are later phases — not missing, just not in scope yet.

### Day-to-day usage
- Open the app (running locally)
- Type a keyword
- Get a list
- Click through to whichever jobs look good, on the real site, and apply manually there

### Why this scope first
It's a self-contained, useful tool on its own — even without later phases, it saves the
"check 3 job sites every morning" routine. It's also the foundation every later phase
(AI resume, auto-apply) will sit on top of.

---

## Later phases (not started yet)

- **Phase 2:** AI-tailored resume text generated per job description
- **Phase 3:** Generate a formatted resume file (PDF/DOCX) from the tailored text
- **Phase 4:** Auto-fill and submit applications directly on the job site (per site,
  one at a time)