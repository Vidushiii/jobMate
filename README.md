# JobMate — AI-Powered Job Discovery Platform

> Signal over volume. Upload your resume, get only the jobs that actually fit.

---

## What is JobMate?

JobMate is an AI-powered job discovery platform that understands the *intent* behind your resume — not just keywords — and surfaces only the top-matching live job listings with transparent match scores, and direct apply links.

No spray-and-pray. No ghost listings. No noise.

---

## Features

- **AI Resume Parsing** — Upload a PDF or DOCX resume; Gemini 2.5 Flash extracts a deep semantic profile instantly
- **Semantic Job Matching** — Jobs are scored on skills (50%), title (30%), and domain (20%) — not keyword overlap
- **Keyword Gap Analysis** — Green tags (you have it) and amber tags (you're missing it) for every job match
- **Anonymous Access** — Upload, match, and apply with zero signup required
- **Nightly Email Alerts** — Authenticated users get daily curated matches above their score threshold
- **Niche Vertical Targeting** — Optimized for AI/ML, Product, Design, Data, and generalist white-collar roles

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Backend | Supabase (Auth, Database, Storage, Edge Functions) |
| AI | Google Gemini 2.5 Flash via `@google/generative-ai` |
| Job Data | Adzuna API |
| Email | Resend |
| Resume Parsing | `pdf-parse-fork`, `mammoth` |

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-username/jobmate.git
cd jobmate
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key
ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_APP_KEY=your_adzuna_app_key
RESEND_API_KEY=your_resend_api_key
CRON_SECRET=your_random_cron_secret
```

### 4. Run locally

```bash
npm run dev
```

---

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration in the SQL Editor:
   ```
   supabase/migrations/001_initial_schema.sql
   ```
3. Enable Supabase Auth and Storage

---

## Deploying

### Frontend → Vercel

1. Push repo to GitHub
2. Import project at [vercel.com](https://vercel.com)
3. Import your `.env.local` for environment variables
4. Deploy — Vercel auto-detects Next.js

### Edge Function → Supabase

```bash
supabase functions deploy nightly-match --project-ref <your-project-ref>

supabase secrets set \
  GEMINI_API_KEY=... \
  ADZUNA_APP_ID=... \
  ADZUNA_APP_KEY=... \
  RESEND_API_KEY=... \
  CRON_SECRET=...
```

### Schedule Nightly Job

Run in Supabase SQL Editor:

```sql
select cron.schedule(
  'nightly-job-match',
  '0 8 * * *',
  $$
  select net.http_post(
    url      := 'https://<project-ref>.supabase.co/functions/v1/nightly-match',
    headers  := '{"Content-Type": "application/json", "Authorization": "Bearer <CRON_SECRET>"}'::jsonb,
    body     := '{}'::jsonb
  ) as request_id;
  $$
);
```

---

## Project Structure

```
src/
└── app/
    ├── api/
    │   ├── parse-resume/
    │   ├── fetch-jobs/
    │   ├── score-jobs/
    │   ├── save-profile/
    │   ├── dashboard-jobs/
    │   ├── notifications/
    │   ├── applied-jobs/
    │   └── delete-account/
    └── (pages)/
supabase/
├── functions/
│   └── nightly-match/
└── migrations/
    └── 001_initial_schema.sql
```
---

## Built by

**Vidushi Tomar** — Product Manager  
JobMate v1.0 — May 2026
