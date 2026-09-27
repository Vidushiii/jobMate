// Supabase Edge Function — Deno runtime
// Runs nightly to match users' resumes against fresh Adzuna job listings,
// score with Gemini, and save strong matches as in-app notifications.
// Schedule in Supabase Dashboard: 0 8 * * * (8 AM UTC daily)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs/us/search/1";
const GEMINI_MODEL = "gemini-3.8-flash";

// ──────────────────────────────────────────────────────────────
// Auth guard
// ──────────────────────────────────────────────────────────────
function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("Authorization");
  const secret = Deno.env.get("CRON_SECRET");
  return auth === `Bearer ${secret}`;
}

// ──────────────────────────────────────────────────────────────
// Adzuna fetch
// ──────────────────────────────────────────────────────────────
interface AdzunaResult {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  description: string;
  salary_min?: number;
  salary_max?: number;
  redirect_url: string;
  created: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim();
}

async function fetchJobs(
  skills: string[],
  role: string
): Promise<AdzunaResult[]> {
  const query = [role, ...skills.slice(0, 5)].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    app_id: Deno.env.get("ADZUNA_APP_ID")!,
    app_key: Deno.env.get("ADZUNA_APP_KEY")!,
    results_per_page: "20",
    what: query,
    content_type: "application/json",
  });

  const res = await fetch(`${ADZUNA_BASE}?${params}`);
  if (!res.ok) throw new Error(`Adzuna error: ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

// ──────────────────────────────────────────────────────────────
// Gemini helpers (REST, no SDK)
// ──────────────────────────────────────────────────────────────
async function geminiGenerate(prompt: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

function cleanJson(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

interface ResumeProfile {
  skills: string[];
  implied_skills: string[];
  job_titles: string[];
  experience_years: number;
  industries: string[];
  achievements: string[];
}

async function parseResume(rawText: string): Promise<ResumeProfile> {
  const raw = await geminiGenerate(
    `Extract a semantic profile from this resume. Return JSON only:
{"skills":[],"implied_skills":[],"job_titles":[],"experience_years":0,"industries":[],"achievements":[]}

Resume:
${rawText.slice(0, 4000)}`
  );

  try {
    return JSON.parse(cleanJson(raw));
  } catch {
    return {
      skills: [],
      implied_skills: [],
      job_titles: [],
      experience_years: 0,
      industries: [],
      achievements: [],
    };
  }
}

interface ScoredJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  match_score: number;
  reasoning: string;
}

async function scoreJobs(
  profile: ResumeProfile,
  jobs: AdzunaResult[]
): Promise<ScoredJob[]> {
  if (!jobs.length) return [];

  const jobList = jobs.map((j, i) => ({
    index: i,
    title: j.title,
    company: j.company.display_name,
    description: stripHtml(j.description ?? "").slice(0, 800),
  }));

  const raw = await geminiGenerate(
    `Score how well this candidate matches each job. Match MEANING not keywords.
Candidate: ${JSON.stringify({ skills: profile.skills, implied_skills: profile.implied_skills, job_titles: profile.job_titles })}
Jobs: ${JSON.stringify(jobList)}
Return JSON array: [{"index":0,"score":0,"reasoning":""}]
score is 0-100 integer.`
  );

  let scores: { index: number; score: number; reasoning: string }[] = [];
  try {
    scores = JSON.parse(cleanJson(raw));
  } catch {
    return [];
  }

  return scores
    .map((s) => {
      const job = jobs[s.index];
      if (!job) return null;
      return {
        id: job.id,
        title: job.title,
        company: job.company.display_name,
        location: job.location.display_name,
        url: job.redirect_url,
        match_score: Math.round(s.score),
        reasoning: s.reasoning,
      };
    })
    .filter((j): j is ScoredJob => j !== null && j.match_score >= 70)
    .sort((a, b) => b.match_score - a.match_score);
}

// ──────────────────────────────────────────────────────────────
// Main handler
// ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch all users with notifications enabled and a saved resume
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, resume_text")
    .eq("notification_enabled", true)
    .not("resume_text", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  const results = [];

  for (const profile of profiles ?? []) {
    try {
      // Parse resume into skill profile
      const resumeProfile = await parseResume(profile.resume_text ?? "");

      if (!resumeProfile.skills.length && !resumeProfile.job_titles.length) {
        results.push({ id: profile.id, status: "skipped: empty profile" });
        continue;
      }

      // Fetch live jobs
      const rawJobs = await fetchJobs(
        resumeProfile.skills,
        resumeProfile.job_titles[0] ?? ""
      );

      // Score and filter ≥70%
      const matched = await scoreJobs(resumeProfile, rawJobs);

      if (!matched.length) {
        results.push({ id: profile.id, status: "no matches ≥70%" });
        continue;
      }

      // Insert notifications
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(
          matched.map((j) => ({
            user_id: profile.id,
            job_title: j.title,
            company: j.company,
            match_score: j.match_score,
            job_url: j.url,
            status: "new",
          }))
        );

      if (insertError) {
        results.push({ id: profile.id, status: `insert error: ${insertError.message}` });
        continue;
      }

      results.push({ id: profile.id, status: `saved ${matched.length} matches` });

      // Rate limit: wait between users
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      results.push({
        id: profile.id,
        status: `error: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { "Content-Type": "application/json" } }
  );
});
