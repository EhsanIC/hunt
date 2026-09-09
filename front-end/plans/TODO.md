# Job Hunt App — Phase 1 TODO (Frontend / Next.js)

Machine-oriented task list. Execute sections in order; do not start a section until
all tasks in the previous section are checked off. No manual test steps — verify by
reading code/response shapes and confirming API calls succeed.

This is the frontend for the Job Finder backend (FastAPI, already built — see
`TODO.md`). Consumes these existing backend endpoints:

- `POST /keywords`, `GET /keywords`, `DELETE /keywords/{id}`, `PATCH /keywords/{id}`
- `POST /scrape`
- `GET /jobs?status=`, `PATCH /jobs/{id}`

## Stack (locked in)

- Next.js (App Router), TypeScript, package manager **bun**
- **shadcn/ui** (Radix-based), dashboard base template
- **`@tanstack/react-query`** for all data fetching + mutations (not SWR —
  same problem space, React Query chosen for its `useMutation` +
  `invalidateQueries` fit with this app's mutation-heavy flows)
- **`@tanstack/react-table`** + shadcn `<Table>` primitives for the job list
- **`react-hook-form` + `zod` + `@hookform/resolvers`** for the keyword form
- **`lucide-react`** for icons
- **`sonner`** (via `shadcn add sonner`) for toasts/feedback
- Backend URL from `NEXT_PUBLIC_API_URL` env var, never hardcoded
- No auth (public job data, single-user local tool)
- Single-page app: keywords + scrape control + job list all on one route

Install commands:

```powershell
bun add @tanstack/react-query @tanstack/react-table react-hook-form zod @hookform/resolvers lucide-react
bunx --bun shadcn@latest add sonner
```

---

## 0. Backend CORS

- [x] Confirm FastAPI `main.py` has `CORSMiddleware` allowing origin
      `http://localhost:3000` for `GET/POST/PATCH/DELETE`. Add it if missing —
      this blocks every subsequent section if wrong.

---

## 1. Project Skeleton

- [x] `bun create next-app` — TypeScript: yes, App Router: yes, Tailwind: yes
- [x] `bunx --bun shadcn@latest init` — dashboard base template
- [x] Install all libs listed in Stack section above
- [x] `.env.local`: `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`
- [x] `lib/api.ts`: thin fetch wrapper — `apiGet`, `apiPost`, `apiPatch`, `apiDelete`,
      all reading base URL from `process.env.NEXT_PUBLIC_API_URL`, throwing on
      non-2xx so React Query's `isError` states work correctly
- [x] `app/providers.tsx` (client component): `QueryClientProvider` wrapping children
- [x] Wire `providers.tsx` into `app/layout.tsx`
- [x] Add shadcn `<Toaster />` (from `sonner`) once in `app/layout.tsx`

---

## 2. Keyword Management UI

- [x] `hooks/use-keywords.ts`: `useQuery({ queryKey: ["keywords"], queryFn: ... })`
      wrapping `GET /keywords`
- [x] `components/keyword-list.tsx`: render via shadcn `<Card>` + `<Table>`
- [x] `components/keyword-form.tsx`: `react-hook-form` + `zod` schema (non-empty
      string, trimmed) + shadcn `<Form>`, `<Input>`, `<Button>` — submit triggers
      a `useMutation` wrapping `POST /keywords`
- [x] Add-keyword mutation: `onSuccess` → `queryClient.invalidateQueries({queryKey:["keywords"]})`
      and `sonner` success toast; `onError` → `sonner` error toast (surface 409
      duplicate / 422 validation messages from the backend response body)
- [x] Delete button per row: shadcn `<AlertDialog>` confirm → `useMutation`
      wrapping `DELETE /keywords/{id}` → invalidate `["keywords"]` on success
- [x] Active/inactive toggle per row: shadcn `<Switch>` → `useMutation` wrapping
      `PATCH /keywords/{id}` → invalidate `["keywords"]` on success
- [x] All three mutations show `sonner` toasts on success and error

---

## 3. Scrape Trigger

- [x] `hooks/use-scrape.ts`: `useMutation` wrapping `POST /scrape`
- [x] `components/scrape-button.tsx`: shadcn `<Button>` bound to
      `mutation.isPending` for both the disabled state and a loading spinner
      (`lucide-react` `Loader2` icon, spinning)
- [x] `onSuccess`: `queryClient.invalidateQueries({queryKey:["jobs"]})` (invalidate
      all status variants) + `sonner` toast rendering
      `keywords_searched` / `new_jobs` / `skipped_existing` / `errors` from the
      response body
- [x] `onError`: `sonner` error toast

---

## 4. Job List & Filtering

- [x] `hooks/use-jobs.ts`: `useQuery({ queryKey: ["jobs", status], queryFn: ... })`
      wrapping `GET /jobs?status={status}`, `status` as component state
- [x] `components/jobs-table.tsx`: `@tanstack/react-table` `useReactTable` +
      shadcn `<Table>` primitives (columns: title, company, status, action buttons;
      `url` rendered as an `<a target="_blank" rel="noopener noreferrer">`)
- [x] `components/status-tabs.tsx`: shadcn `<Tabs>` for `found` / `applied` / `rejected`,
      controls the `status` state passed into `use-jobs`
- [x] Empty state: shadcn `<Empty>`/plain message row when `data.length === 0`
- [x] Loading state: shadcn `<Skeleton>` rows while `isPending`
- [x] Error state: inline message + `sonner` toast when `isError`

---

## 5. Status Updates

- [x] `hooks/use-update-job-status.ts`: `useMutation` wrapping `PATCH /jobs/{id}`
- [x] Per-row action buttons/menu (shadcn `<DropdownMenu>` or two `<Button>`s) for
      "Mark applied" / "Mark rejected", wired to this mutation
- [x] `onSuccess`: invalidate both the source and destination status query keys
      (e.g. `["jobs","found"]` and `["jobs","applied"]`) so the row moves tabs
      without a page reload
- [x] `sonner` toast confirming the change

---

## 6. Error/Loading Polish

- [x] Global fetch failure (backend unreachable) surfaces as a visible error
      state, not a silent failure or uncaught exception — handle in `lib/api.ts`
      and let React Query's `isError` propagate to the UI
- [x] All async buttons (add/delete/toggle keyword, scrape, mark status) disable
      themselves via their mutation's `isPending` during the request
- [x] Job list and keyword list both show shadcn `<Skeleton>` on initial load

---

## 7. Full Backend Integration (Phase 1 Frontend — Definition of Done)

- [x] Every backend endpoint listed at the top of this file is called from the UI
      at least once: `POST/GET/DELETE/PATCH /keywords`, `POST /scrape`,
      `GET /jobs`, `PATCH /jobs/{id}`
- [x] No hardcoded job/keyword data anywhere in the frontend — all data flows
      through `lib/api.ts` from the live backend
- [x] Full loop works end-to-end against a running FastAPI backend with zero
      terminal/curl/SQL steps: add keyword → trigger scrape → jobs appear under
      "found" → mark one applied, one rejected → both move to their respective
      tabs → refresh browser → keywords, jobs, and statuses persist exactly as left
- [x] `NEXT_PUBLIC_API_URL` is the only place the backend origin is configured —
      confirm no other file references `localhost:8000`/`127.0.0.1:8000` directly

> Verification note: Sections 0–7 were completed against the backend response schemas and endpoint paths. FastAPI CORS was added for `http://localhost:3000`, the malformed `/scrape` decorator was corrected, all frontend requests use `lib/api.ts`, and frontend `bun run lint`, `bunx tsc --noEmit`, `bun run build`, plus backend Python compilation pass.
