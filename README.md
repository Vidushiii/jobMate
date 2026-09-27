# JobMate: AI-Powered Job Discovery

> Signal over volume. Upload your resume and see only the jobs that fit you.

JobMate reads your resume the way a recruiter does. It looks at what you actually did, not only the keywords you used. It then pulls live job listings and scores each one against your profile, showing a match score, what you have, what you're missing, and a direct apply link.

No account is needed. Upload a resume and you get ranked matches straight away. The app also has account support (saved resume, personalised dashboard, applied-job tracking and nightly in-app alerts), but the sign-in and sign-up links are currently hidden from the UI.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [How It Works (End to End)](#how-it-works-end-to-end)
4. [Project Structure](#project-structure)
5. [Getting Started (Local Setup)](#getting-started-local-setup)
6. [Supabase Setup](#supabase-setup)
7. [Environment Variables](#environment-variables)
8. [API Reference](#api-reference)
9. [Database Schema](#database-schema)
10. [AI Matching Pipeline](#ai-matching-pipeline)
11. [Search, Filters & Pagination](#search-filters--pagination)
12. [Nightly Job Alerts (Edge Function)](#nightly-job-alerts-edge-function)
13. [Deployment](#deployment)
14. [Privacy, Consent & Account Deletion](#privacy-consent--account-deletion)
15. [Design System](#design-system)
16. [Known Limitations](#known-limitations)
17. [Troubleshooting](#troubleshooting)

---

## Features

| Feature | What it does |
|---|---|
| **AI resume parsing** | Upload a PDF or DOCX (up to 5 MB). Gemini extracts skills, *implied* skills, job titles, years of experience, industries, achievements, and 3–5 standard search terms recruiters would use. |
| **Semantic job matching** | Every job is scored 0–100 on meaning, not keyword overlap. The score has three parts: skills (50), title/seniority (30) and domain (20). |
| **Skill-gap analysis** | Each job shows what you already have (matched) and what's genuinely missing, plus a one-line explanation of the score. |
| **Anonymous mode** | Upload, match and apply without signing up. Nothing is stored on the server. |
| **Authenticated dashboard** | Signed-in users see matched jobs as soon as they open the homepage, based on their saved resume. |
| **Applied-job tracking** | Mark jobs as applied (and undo). The state stays across sessions. |
| **Nightly job alerts** | For users who opt in, new matches scoring 70% or higher are added to the `/notifications` page each night. No emails are sent. |
| **Filters & pagination** | Search by keyword, city (major Indian cities or Remote) and work type. Results show 20 per page, and pages you've already visited load instantly from a cache. |
| **Consent & data control** | A consent modal appears before any resume is processed. There are Privacy and Terms pages, and users can delete their account and all its data with one action. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 (CSS-first config in `globals.css`), `lucide-react` icons |
| Auth / DB / Storage | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) |
| Background jobs | Supabase Edge Functions (Deno) + `pg_cron` |
| AI | Google Gemini 3.8 Flash, falling back to 2.5 Flash (`@google/generative-ai`), JSON mode, temperature 0.1 |
| Job data | [Adzuna API](https://developer.adzuna.com/) |
| File parsing | `pdf-parse-fork` (PDF), `mammoth` (DOCX), both server-only |
| Validation | `zod` |
| Upload UI | `react-dropzone` |

---

## How It Works (End to End)

### Architecture

```
┌──────────────────────────── Browser ────────────────────────────┐
│  /  (upload flow or AuthDashboard)   /profile   /notifications  │
│  React state + page cache (anonymous data never leaves the tab) │
└───────────────┬─────────────────────────────────────────────────┘
                │ fetch
┌───────────────▼──────────── Next.js Route Handlers ─────────────┐
│ parse-resume   fetch-jobs   score-jobs   dashboard-jobs         │
│ save-profile   applied-jobs notifications delete-account        │
└──────┬──────────────┬───────────────┬────────────────┬──────────┘
       │              │               │                │
  pdf-parse /     Adzuna API      Gemini API       Supabase
   mammoth       (live jobs)     (parse+score)   (Auth + Postgres)
                                                       ▲
┌──────────────────── Supabase Edge Function ──────────┴──────────┐
│ nightly-match (pg_cron, 08:00 UTC): profiles → Gemini → Adzuna  │
│ → Gemini score → insert notifications                           │
└─────────────────────────────────────────────────────────────────┘
```

### Flow 1: Anonymous user

1. The user drops a resume onto the homepage (`ResumeDropzone`).
2. **`ConsentModal`** appears and blocks everything until the user accepts. Accepting sends `consent_token=user_consented` with the upload. Without it the server returns `403`.
3. **`POST /api/parse-resume`** checks the file type and size, extracts the text with `pdf-parse-fork` or `mammoth`, and sends it to Gemini, which returns a structured `ParsedResume`.
4. **`POST /api/fetch-jobs`** tries each of Gemini's `search_terms` against Adzuna in turn and keeps the first term that returns results. If none do, it falls back to `role + top 5 skills`.
5. **`POST /api/score-jobs`** sends the resume profile and all 20 jobs to Gemini in **one batched call**. The jobs come back scored and sorted by `overall_score`, highest first.
6. Results appear in `JobList` / `JobCard`. `SkillGapDrawer` shows the matched and missing skills for each job.
7. Everything lives only in React state and is gone when the user refreshes or closes the tab.

### Flow 2: Authenticated user uploads or replaces a resume

This is the same pipeline as Flow 1. After parsing, **`POST /api/save-profile`** upserts `resume_text` (and the filename and upload time) into `profiles`, which lets the nightly job reuse it. Users can also replace their resume from `/profile`.

### Flow 3: Authenticated dashboard

1. `/` detects the auth state and shows `loading` (skeleton), then either `authenticated` (`AuthDashboard`) or `anonymous` (upload flow).
2. When it loads, `AuthDashboard` calls **`POST /api/dashboard-jobs`**. The route reads the saved `resume_text`, parses it (cached in memory), fetches jobs, scores them and marks the ones already in `applied_jobs`.
3. If the user has no saved resume, the dashboard asks them to upload one.
4. Filters: the search box waits 2 seconds after the user stops typing before searching (Enter searches immediately). Changing the city or work type searches straight away.
5. **Apply / Undo** calls `POST /api/applied-jobs` or `DELETE /api/applied-jobs/[job_id]`.

### Flow 4: Nightly alerts

1. At 08:00 UTC, `pg_cron` calls the `nightly-match` Edge Function with a bearer secret.
2. For each profile with `notification_enabled = true` and a `resume_text`, the function parses the resume, fetches jobs, scores them and keeps only matches of **70% or higher**.
3. It inserts those matches into `notifications`.
4. Users see them on **`/notifications`** and can mark each one as `viewed` or `applied`.

### Route protection

`src/proxy.ts` is the Next.js 16 replacement for `middleware.ts`. It refreshes the Supabase session cookie on every request. If a signed-out user opens `/profile` or `/notifications`, it redirects them to `/login?redirect=<path>`. After logging in, users go to `/`. The `/login` and `/signup` pages still exist, but nothing in the UI links to them at the moment.

---

## Project Structure

```
jobmate/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Home: anonymous upload flow OR AuthDashboard
│   │   ├── layout.tsx                # Root layout (Navbar + Footer)
│   │   ├── globals.css               # Tailwind v4 @theme tokens (coral accent)
│   │   ├── login/ signup/            # Supabase email auth
│   │   ├── profile/                  # Personal info, resume, notification settings, delete account
│   │   ├── notifications/            # Nightly matches inbox
│   │   ├── privacy/ terms/           # Static legal pages
│   │   └── api/
│   │       ├── parse-resume/         # PDF/DOCX → text → Gemini profile
│   │       ├── fetch-jobs/           # Profile/query → Adzuna
│   │       ├── score-jobs/           # Profile + jobs → Gemini scores
│   │       ├── dashboard-jobs/       # One-shot pipeline for signed-in users
│   │       ├── save-profile/         # Persist resume_text
│   │       ├── applied-jobs/         # POST mark applied, [job_id]/DELETE undo
│   │       ├── notifications/        # GET list, PATCH status
│   │       └── delete-account/       # DELETE user (service role)
│   ├── components/
│   │   ├── dashboard/AuthDashboard.tsx
│   │   ├── jobs/                     # JobList (+ PaginationBar), JobCard, MatchScoreBadge, SkillGapDrawer
│   │   ├── resume/                   # ResumeDropzone, ConsentModal
│   │   ├── profile/ProfileForm.tsx
│   │   ├── notifications/NotificationItem.tsx
│   │   ├── layout/                   # Navbar, Footer
│   │   └── ui/                       # Badge, Button, Card, Modal, Spinner, Toast
│   ├── lib/
│   │   ├── gemini.ts                 # parseResume(), scoreJobs(), retry + cache
│   │   ├── adzuna.ts                 # fetchJobs(), HTML stripping
│   │   ├── pdf-parser.ts             # extractTextFromBuffer()
│   │   └── supabase/                 # client.ts, server.ts, admin.ts
│   ├── types/index.ts                # ParsedResume, AdzunaJob, ScoredJob, UserProfile, …
│   └── proxy.ts                      # Session refresh + route protection
├── supabase/
│   ├── functions/nightly-match/      # Deno Edge Function
│   └── migrations/001_initial_schema.sql
├── .env.example
├── next.config.ts                    # serverExternalPackages, 5 MB body limit
└── CLAUDE.md                         # Architecture notes for AI-assisted development
```

---

## Getting Started (Local Setup)

### Prerequisites

- Node.js 20+ and npm
- A [Supabase](https://supabase.com) project (the free tier is enough)
- A [Google AI Studio](https://aistudio.google.com/app/apikey) API key for Gemini
- An [Adzuna developer](https://developer.adzuna.com/) app ID and key
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (only needed to deploy the Edge Function)

### Steps

```bash
# 1. Clone
git clone https://github.com/Vidushiii/jobMate.git
cd jobMate

# 2. Install
npm install

# 3. Configure env
cp .env.example .env.local
# …then fill in the values (see Environment Variables below)

# 4. Set up the database (see Supabase Setup below)

# 5. Run
npm run dev
# → http://localhost:3000
```

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

> Tip: if the Supabase variables are missing, `proxy.ts` skips auth, so the anonymous flow still runs. You still need `GEMINI_API_KEY` and the Adzuna keys to get results.

---

## Supabase Setup

1. **Create a project** at supabase.com. Copy the Project URL, the `anon` key and the `service_role` key from **Settings → API**.
2. **Run the migration.** Open **SQL Editor** and run `supabase/migrations/001_initial_schema.sql`. This creates:
   - the `profiles` and `notifications` tables and the `notification_status` enum
   - Row-Level Security policies (each user can access only their own rows)
   - a private `resumes` storage bucket, with per-user folder policies
   - a trigger that creates a `profiles` row automatically on signup
   - a trigger that keeps `updated_at` current
3. **Create the `applied_jobs` table.** It is used by the app but **not yet included in the migration**, so run this as well:

   ```sql
   create table public.applied_jobs (
     id         uuid default uuid_generate_v4() primary key,
     user_id    uuid not null references public.profiles(id) on delete cascade,
     job_id     text not null,
     job_title  text,
     company    text,
     job_url    text,
     applied_at timestamptz not null default now()
   );

   create unique index applied_jobs_user_job_idx
     on public.applied_jobs(user_id, job_id);

   alter table public.applied_jobs enable row level security;

   create policy "applied_jobs_self_crud"
     on public.applied_jobs for all
     using (auth.uid() = user_id)
     with check (auth.uid() = user_id);
   ```

4. **Auth.** Under **Authentication → Providers**, enable Email. Under **Authentication → URL Configuration**, set the Site URL (`http://localhost:3000` for local development, your production URL once deployed).
5. **Extensions (for nightly alerts).** Under **Database → Extensions**, enable `pg_cron` and `pg_net`.

---

## Environment Variables

Create `.env.local` in the project root (`.env.example` is a template):

| Variable | Where it's used | Public? | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Yes | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Yes | Safe to expose because RLS protects the data |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/admin.ts` | **No** | Bypasses RLS. Used only for account deletion. Never prefix it with `NEXT_PUBLIC_` |
| `GEMINI_API_KEY` | `lib/gemini.ts`, Edge Function | **No** | |
| `ADZUNA_APP_ID` | `lib/adzuna.ts`, Edge Function | **No** | |
| `ADZUNA_APP_KEY` | `lib/adzuna.ts`, Edge Function | **No** | |
| `CRON_SECRET` | Edge Function | **No** | Any long random string. It must match the value in the `pg_cron` SQL |

All AI and Adzuna calls run on the server, so these keys never reach the browser.

---

## API Reference

All routes are Next.js Route Handlers under `src/app/api/`. Errors return `{ "error": string }` with an appropriate status code.

| Method & Path | Auth | Request | Response |
|---|---|---|---|
| `POST /api/parse-resume` | None | `multipart/form-data`: `resume` (PDF/DOCX, ≤5 MB), `consent_token=user_consented` | `ParsedResume` |
| `POST /api/fetch-jobs` | None | JSON: `{ skills?, role?, search_terms?, customQuery?, location?, jobType?: "remote"\|"hybrid"\|"onsite"\|"", page?: 1–10 }` | `{ jobs: AdzunaJob[], totalCount }` |
| `POST /api/score-jobs` | None | JSON: `{ resume: ParsedResume, jobs: AdzunaJob[] }` | `{ jobs: ScoredJob[] }` sorted by score, highest first |
| `POST /api/dashboard-jobs` | Required | JSON (optional): `{ customQuery?, location?, workType? }` | `{ jobs, hasResume, parsedResume, appliedJobIds }` |
| `POST /api/save-profile` | Required | JSON: `{ resume: ParsedResume, filename? }` | `{ success: true }` |
| `POST /api/applied-jobs` | Required | JSON: `{ job_id, job_title, company, job_url }` | `{ success: true }` (idempotent) |
| `DELETE /api/applied-jobs/[job_id]` | Required | — | `{ success: true }` |
| `GET /api/notifications` | Required | — | `{ notifications: Notification[] }` (latest 50) |
| `PATCH /api/notifications` | Required | JSON: `{ id, status: "new"\|"viewed"\|"applied" }` | `{ success: true }` |
| `DELETE /api/delete-account` | Required | — | `{ success: true }` |

**Common status codes:** `400` for invalid input, `401` when not signed in, `403` when consent is missing, `422` for an unreadable resume, and `500` for an upstream or database error.

### Key types (`src/types/index.ts`)

```ts
interface ParsedResume {
  rawText: string;
  skills: string[];
  implied_skills: string[];   // e.g. "managed team of 12" → leadership
  job_titles: string[];
  search_terms: string[];     // 3–5 recruiter-standard titles for Adzuna
  experience_years: number;
  industries: string[];
  achievements: string[];
}

interface ScoredJob extends AdzunaJob {
  overall_score: number;  // 0–100
  skills_score: number;   // 0–50
  title_score: number;    // 0–30
  domain_score: number;   // 0–20
  matched: string[];
  missing: string[];
  reasoning: string;
  applied?: boolean;
}
```

---

## Database Schema

### `profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK to `auth.users`, cascade delete |
| `email` | text | |
| `full_name`, `location`, `linkedin_url` | text | Editable on `/profile` |
| `resume_url` | text | Currently stores `filename\|ISO-timestamp` |
| `resume_text` | text | Extracted plain text, reused by the dashboard and the nightly job |
| `notification_enabled` | boolean | Default `false` |
| `notification_frequency` | text | `daily` \| `weekly` \| `instant` (default `daily`) |
| `created_at`, `updated_at` | timestamptz | |

### `notifications`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | FK to `profiles`, cascade delete |
| `job_title`, `company`, `job_url` | text | |
| `match_score` | integer | 0–100 |
| `status` | enum | `new` \| `viewed` \| `applied` |
| `created_at` | timestamptz | Indexed (descending) |

### `applied_jobs`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | FK to `profiles`, cascade delete |
| `job_id` | text | Adzuna job ID |
| `job_title`, `company`, `job_url` | text | |
| `applied_at` | timestamptz | Default `now()` |
| | | Unique on `(user_id, job_id)` |

**Cascade chain:** deleting a user from `auth.users` deletes their `profiles` row, which deletes their `notifications` and `applied_jobs` rows.

---

## AI Matching Pipeline

The main logic lives in `src/lib/gemini.ts`.

**Model config:** `gemini-3.8-flash` as the primary model and `gemini-2.5-flash` as the fallback (`GEMINI_MODELS` in `gemini.ts`), with `responseMimeType: application/json` and `temperature: 0.1`. The code also strips stray Markdown code fences from the output before parsing it.

### 1. Resume parsing: `parseResume(rawText)`
- Extracts explicit skills plus **implied skills** by reading each sentence for what the candidate actually did.
- Turns niche jargon into standard job titles that recruiters search for (`search_terms`), which drive the Adzuna queries.
- Results are **cached in memory** by a hash of the resume text (up to 50 entries, oldest removed first), so repeat dashboard loads skip Gemini.

### 2. Job fetching: `fetchJobs(query, location, page)` in `lib/adzuna.ts`
- Requests 20 results per page and caches responses for 5 minutes (`revalidate: 300`).
- Strips HTML from job descriptions before they are sent to Gemini.
- Returns Adzuna's `count` as `totalCount`, which the page count is based on.
- Work-type filters are added to the query text (e.g. `"… remote"`).

### 3. Job scoring: `scoreJobs(resume, jobs)`
- Sends **all jobs in a single Gemini call**, with each description cut to 1,500 characters.
- Gemini is prompted as a senior recruiter to credit demonstrated ability even when the exact keyword is absent.
- Gemini fills in `matched` and `missing` first, then scores each part. Full marks are allowed only when that part has no gaps, and every missing item must lower a score.
- Gemini returns only the three part scores. The code caps each one (`skills 0–50`, `title 0–30`, `domain 0–20`) and **adds them up to get `overall_score`**, so the badge and the breakdown always agree.
- If Gemini leaves a job out, that job gets a score of 0 ("Score unavailable"). If the whole response can't be parsed, all jobs come back with 0 scores rather than an error.

### Model fallback & rate limits
When a model returns `429` (rate limit or quota) or `503` (overloaded), the code tries the next model in `GEMINI_MODELS`. If every model fails, it waits 2 seconds and tries the whole list once more. If that also fails, the user sees *"Our AI is at capacity right now. Please try again in a minute."* Any other error is shown immediately.

---

## Search, Filters & Pagination

### Anonymous results page: manual search only
The filter bar **never searches automatically**, so Gemini quota isn't spent on filter changes the user hasn't finished making. A search runs only when the user clicks **Apply** or presses **Enter** in the search box.

```
[🔍 Search (flex-1)]  [📍 Location]  [🏢 Work type]  [Apply ●]
```

- The values on screen (`filters`, `searchQuery`) are tracked separately from the last search that ran (`appliedFilters`, `appliedQuery`).
- `isDirty` is true when the two differ, and a pulsing red dot then appears on **Apply**.
- On mobile the bar wraps to two rows.
- The location options are *All India*, Bengaluru, Mumbai, Delhi NCR, Hyderabad, Pune, Chennai, Gurgaon, Noida, Kolkata, Ahmedabad and Remote.

### Authenticated dashboard: live search
- The search box waits 2 seconds after typing stops, and Enter searches immediately.
- Changing the city or work-type pill searches immediately.

### Pagination
- 20 jobs per page. Each page is fetched from Adzuna and scored by Gemini separately.
- `PaginationBar` shows `[< Prev] [1] [2] [3] … [10] [Next >]` with at most 5 numbered buttons. The current page is highlighted in coral.
- **Page cache:** a `useRef<Map<number, ScoredJob[]>>` keeps scored pages for the rest of the tab session, so returning to a page uses no API calls.
- `lastSearchRef` remembers the query and filters of the last search, so moving to another page repeats the same search.
- Clicking Apply or uploading a new resume clears the cache and goes back to page 1.

---

## Nightly Job Alerts (Edge Function)

The function lives in `supabase/functions/nightly-match/index.ts` and runs on Deno. It calls the Gemini API directly over REST instead of using the SDK, and saves matches to `notifications`. No emails are sent.

### Deploy

```bash
supabase login
supabase functions deploy nightly-match --project-ref <your-project-ref>

supabase secrets set \
  GEMINI_API_KEY=... \
  ADZUNA_APP_ID=... \
  ADZUNA_APP_KEY=... \
  CRON_SECRET=<random-secret> \
  --project-ref <your-project-ref>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to Edge Functions automatically.

### Schedule it (SQL Editor)

```sql
select cron.schedule(
  'nightly-job-match',
  '0 8 * * *',              -- 08:00 UTC daily
  $$
  select net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/nightly-match',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
    body    := '{}'::jsonb
  ) as request_id;
  $$
);
```

### Test it manually

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/nightly-match \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" -d '{}'
# → { "processed": N, "results": [{ "id": "...", "status": "saved 4 matches" }, ...] }
```

---

## Deployment

### Frontend on Vercel
1. Push the repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new). Vercel detects Next.js automatically.
3. Add every variable from `.env.local` under **Project Settings → Environment Variables**.
4. Deploy.
5. In Supabase **Authentication → URL Configuration**, set the Site URL and redirect URLs to your Vercel domain.

### Backend on Supabase
- Run the migration and the `applied_jobs` SQL (see [Supabase Setup](#supabase-setup)).
- Deploy and schedule `nightly-match` (see [Nightly Job Alerts](#nightly-job-alerts-edge-function)).

### Production checklist
- [ ] All env vars are set in Vercel, and none of the secret ones start with `NEXT_PUBLIC_`
- [ ] The migration and the `applied_jobs` table exist
- [ ] Auth Site URL and redirect URLs point to production
- [ ] Edge Function secrets are set and the function is deployed
- [ ] `pg_cron` and `pg_net` are enabled and the job is scheduled

---

## Privacy, Consent & Account Deletion

- **Consent first:** `ConsentModal` must be accepted before a resume is processed, and the server enforces this with `consent_token`. The modal links to `/privacy` and `/terms` (opening in new tabs).
- **Anonymous data** stays only in the browser tab. The server keeps no record of it.
- **Signed-in data:** only the extracted `resume_text` and profile fields are stored, and RLS limits access to the owner.
- **Legal pages:** `/privacy` and `/terms` are static Server Components with a 720 px maximum width. The footer on every page links to Privacy, Terms and Contact (`hello@jobmate.app`).
- **Account deletion:** in the danger zone on `/profile`, the user confirms in a modal, which calls `DELETE /api/delete-account`. The route checks the session, then uses the service-role admin client to call `auth.admin.deleteUser()`. The cascade deletes the user's rows, and the user is redirected to `/`.

---

## Design System

| Token | Value |
|---|---|
| Accent | Coral `#FF3E6C` (`--color-coral`, defined in the `globals.css` `@theme inline` block) |
| Cards | White background, `rounded-xl`, `shadow-sm`, `border border-gray-100` |
| Text | System sans-serif, `gray-900` for body text, `gray-500` for secondary text |
| Loading | Skeleton loaders for every async action |
| Empty states | Every page has one and is never left blank |

Tailwind v4 has no `tailwind.config.ts`. Configuration lives in CSS through `@import "tailwindcss"` and `@theme inline { … }`.

---

## Known Limitations

- **Different job regions.** The web app queries **Adzuna India** (`/jobs/in/`, with Indian city filters), while the nightly Edge Function queries **Adzuna US** (`/jobs/us/`). Align the two in `supabase/functions/nightly-match/index.ts` if you want both to cover the same market.
- **`applied_jobs` is not in the migration file.** Create it manually with the SQL above.
- **`notification_frequency` is not yet used.** The cron job runs daily for every user with alerts enabled, whatever frequency they chose.
- **No de-duplication in the nightly job.** The same job can be inserted on more than one night.
- **The resume file itself isn't stored.** Only the extracted text is saved, and `resume_url` holds `filename|timestamp` rather than a Storage path, even though the `resumes` bucket and its policies exist.
- **Scanned PDFs aren't supported.** Resumes with fewer than 100 characters of extractable text are rejected, and there is no OCR.
- **In-memory cache per instance.** The resume-parse cache lives inside each server instance, so it resets on cold starts.
- **Adzuna pages are capped at 10** by the `fetch-jobs` validator.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| "Consent is required…" (403) | The upload was sent without `consent_token`. Make sure the consent modal was accepted. |
| "We couldn't read this resume…" | The file is a scanned or image-only PDF. Use a PDF with selectable text, or a DOCX. |
| "Our AI is at capacity…" | Both Gemini models were rate-limited or overloaded. Wait a minute or check your quota in Google AI Studio. |
| No jobs returned | The query is too narrow for Adzuna's region. Try a broader search term or "All India". |
| `Adzuna 401/403` in the logs | `ADZUNA_APP_ID` or `ADZUNA_APP_KEY` is wrong or missing. |
| Stuck on the login redirect | Supabase env vars are missing or wrong, or the Site URL is misconfigured. |
| Apply button errors | The `applied_jobs` table or its RLS policy is missing. See Supabase Setup, step 3. |
| Edge Function returns 401 | The `Authorization: Bearer` value doesn't match the `CRON_SECRET` secret. |
| No alerts on `/notifications` | `notification_enabled` is false, the cron job isn't scheduled, or no job scored 70% or higher. |

---

## Built by

**Vidushi Tomar**, Product Manager
JobMate v1.0
