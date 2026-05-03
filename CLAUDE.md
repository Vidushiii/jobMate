# JobMate — AI-Powered Job Search Board

## Stack
- Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- Supabase (Postgres, Auth, Storage, Edge Functions)
- Google Gemini 1.5 Flash (`@google/generative-ai`)
- Adzuna API for live job listings
- Resend for transactional email

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-only, never NEXT_PUBLIC_
GEMINI_API_KEY=                  # server-only
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
RESEND_API_KEY=                  # server-only
```

## Key Architecture Notes

### Next.js 16 / Tailwind v4 Differences
- `cookies()` and `headers()` are now **async** — always `await cookies()`
- Tailwind v4: use `@import "tailwindcss"` and `@theme inline { }` — no tailwind.config.ts
- Config key is `serverExternalPackages` (not `experimental.serverComponentsExternalPackages`)
- Custom colors defined in `globals.css` `@theme inline` block
- **`middleware.ts` is deprecated** — renamed to `proxy.ts`, export function must be named `proxy` (not `middleware`)
- `useSearchParams()` requires a `<Suspense>` boundary — wrap in a inner component
- pdf-parse v2 uses `PDFParse` class, not a default function export

### Supabase Auth Pattern
- Browser client: `src/lib/supabase/client.ts` — `createBrowserClient` (singleton)
- Server client: `src/lib/supabase/server.ts` — `createServerClient` (fresh per-request, reads cookies)
- Middleware refreshes sessions via cookie update
- Always use `supabase.auth.getUser()` server-side (not `getSession()` — unverified)

### Server-Only Modules
- `pdf-parse` and `mammoth` are Node.js only — only used in Route Handlers
- All AI calls (Gemini) must be server-side — API keys never reach the client
- All Adzuna calls are server-side only

## Database Schema

### profiles
- id (uuid, FK auth.users)
- email, full_name, location, linkedin_url (text)
- resume_url (text) — Supabase Storage path
- resume_text (text) — extracted plain text for cron matching
- notification_enabled (boolean, default false)
- notification_frequency (enum: daily | weekly | instant)
- created_at (timestamp)

### notifications
- id (uuid), user_id (uuid FK profiles)
- job_title, company (text)
- match_score (integer)
- job_url (text)
- status (enum: new | viewed | applied)
- created_at (timestamp)

### applied_jobs
- id (uuid, PK)
- user_id (uuid FK profiles, cascade delete)
- job_id (text) — Adzuna job ID
- job_title, company, job_url (text)
- applied_at (timestamp with timezone, default now UTC)
- Unique index on (user_id, job_id)

## Design System
- Accent: coral `#FF3E6C` (var --color-coral)
- Cards: white bg, `shadow-sm`, `rounded-xl`, `border border-gray-100`
- Typography: system sans-serif, gray-900 body, gray-500 secondary
- Empty states on every page — never blank
- Skeleton loaders on every async action

## AI Pipeline (Flow 1)
1. `POST /api/parse-resume` — PDF/DOCX → Gemini → structured JSON profile
2. `POST /api/fetch-jobs` — skills + role → Adzuna API → job list
3. `POST /api/score-jobs` — resume + jobs → Gemini → ranked scored jobs
4. Results displayed ranked by overall_score desc, max 20 per page

## Adzuna API
- Base: `https://api.adzuna.com/v1/api/jobs/us/search/1`
- Params: app_id, app_key, results_per_page=20, what, where
- Strip HTML from description before sending to Gemini
- Response includes `count` (total matching jobs) — returned as `totalCount` by `fetchJobs()`

## Filter Bar & Search Behavior

### Manual-Search-Only Pattern
The filter bar **never fires a search automatically**. The only search triggers are:
- Clicking the **Apply** button
- Pressing **Enter** while focused in the search input

This prevents wasting Gemini quota on intermediate filter states. Users can adjust all three
filters (query, city, work type) and fire one search with their final selection.

When any filter value differs from what was last applied, the Apply button shows a small
pulsing red dot (dirty indicator) signaling there are unapplied changes.

### Filter Bar Layout
Single horizontal row on desktop; wraps to 2 rows on mobile:
```
[🔍 Search input (flex-1)]  [📍 Location (140px)]  [🏢 Work type (140px)]  [Apply (100px)]
```
Mobile row 1: search (full width). Mobile row 2: location + worktype + Apply (flex-1 each).

### State Split
- `filters` / `searchQuery` — staged values (what's in the UI)
- `appliedFilters` / `appliedQuery` — last values used in a search
- `isDirty` — true when staged ≠ applied → shows dirty dot on Apply button

## Pagination

### Per-Page Behavior
- 20 jobs per page (Adzuna `results_per_page=20`)
- Page number passed as `page` param to `/api/fetch-jobs`
- Each page is independently fetched from Adzuna and scored by Gemini
- A new search (Apply button) resets to page 1 and clears the cache

### Client-Side Page Cache
Scored results are cached in a `useRef<Map<number, ScoredJob[]>>` (lives for the tab session).
When navigating to a previously visited page, results are shown instantly from cache — no API calls.
Cache is cleared whenever the user clicks Apply or uploads a new resume.

### Search Parameter Memory
`lastSearchRef` stores `{ customQuery, filters }` from the most recent search so that
`handlePageChange` knows which query/filters to re-use when fetching subsequent pages.

### Pagination UI
Numbered buttons in `JobList` (`PaginationBar` component):
```
[< Prev]  [1]  [2]  [3]  …  [10]  [Next >]
```
- Current page: coral background (#FF3E6C)
- Max 5 page buttons shown at a time with `…` ellipsis
- Total pages computed from `totalCount` (Adzuna's `count` field) ÷ 20

## Two User Flows

### Flow 1 — Anonymous (no account)
1. User drops resume → ConsentModal blocks until accepted
2. `POST /api/parse-resume` extracts text + calls Gemini for structured profile
3. `POST /api/fetch-jobs` hits Adzuna for live listings
4. `POST /api/score-jobs` calls Gemini to score each job (0-100)
5. Results shown ranked in client state; cleared on page refresh or tab close
6. CTA nudges user to create account to save results and enable alerts

### Flow 2 — Authenticated
- Same pipeline as Flow 1 after resume drop
- After parsing, `/api/save-profile` (upsert) saves `resume_text` to `profiles` table
- `/profile` page lets user manage personal info, replace resume, toggle notifications
- `/notifications` page shows matches pushed by the nightly Edge Function
- Nightly cron: fetches `resume_text` from profiles, re-runs pipeline, inserts rows, sends Resend email

## Authenticated Dashboard (Flow 3)
- Homepage (`/`) auto-detects auth state on load
- Auth state: "loading" → skeleton, "authenticated" → AuthDashboard, "anonymous" → existing upload flow
- AuthDashboard fetches jobs via `POST /api/dashboard-jobs` on mount (no user action needed)
- Filter bar: search (debounced 2s), city dropdown, work type pill (single select), search button
- City/worktype changes → immediate re-search; search query → debounced
- Applied jobs tracked in `applied_jobs` table; `job.applied` flag returned by dashboard-jobs route
- Login redirects to `/` (not `/profile`) — default redirect changed

## Anonymous Session
- Session state held entirely in client (React state) — no server-side persistence
- Data exists only for the duration of the active browser session; closing the tab discards it
- Consent modal must be shown before any resume processing

## Nightly Cron Edge Function

### Deployment
```bash
# Deploy the function
supabase functions deploy nightly-match --project-ref <your-project-ref>

# Set secrets (run from project root)
supabase secrets set GEMINI_API_KEY=... ADZUNA_APP_ID=... ADZUNA_APP_KEY=... RESEND_API_KEY=... CRON_SECRET=<random-secret>
```

### Scheduling via Supabase pg_cron
In Supabase Dashboard → SQL Editor, run:
```sql
select cron.schedule(
  'nightly-job-match',           -- job name
  '0 8 * * *',                   -- 8 AM UTC daily
  $$
  select net.http_post(
    url      := 'https://<project-ref>.supabase.co/functions/v1/nightly-match',
    headers  := '{"Content-Type": "application/json", "Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
    body     := '{}'::jsonb
  ) as request_id;
  $$
);
```

### Authorization
The Edge Function requires `Authorization: Bearer {CRON_SECRET}` header. Set `CRON_SECRET` as a Supabase secret (above) and use the same value in the pg_cron SQL.

### Email Sender Domain
`resend.ts` sends from `noreply@jobmate.app`. This domain must be verified in the Resend dashboard. For local testing, you can change the `from` address to `onboarding@resend.dev` (Resend's shared test domain), but emails will only reach the Resend account owner's email.

## Legal Pages

### /privacy — Privacy Policy
- Static Server Component at `src/app/privacy/page.tsx`
- Max-width 720px centered, coral accent only on links
- Last updated: May 2, 2026

### /terms — Terms of Service
- Static Server Component at `src/app/terms/page.tsx`
- Same layout as /privacy

### Footer
- `src/components/layout/Footer.tsx` — renders in root layout on every page
- Links: Privacy Policy, Terms, Contact (mailto:hello@jobmate.app)
- Consent modal links to both pages (target="_blank")

## Account Deletion

**API route**: `DELETE /api/delete-account`
- Verifies current session with anon client
- Uses `createAdminClient()` (service role key) to call `auth.admin.deleteUser(uid)`
- DB cascades: `auth.users` → `profiles` → `notifications` (all deleted automatically)

**Admin client**: `src/lib/supabase/admin.ts` — `createAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY`
Never import this in client components — server Route Handlers only.

**UI**: Delete button in ProfileForm danger zone → inline confirmation modal → redirect to `/` on success.
