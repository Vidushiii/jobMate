import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ParsedResume, AdzunaJob, ScoredJob } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Primary model first; on overload or rate limit, fall through to the next one
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-2.5-flash"];

function getModel(name: string) {
  return genAI.getGenerativeModel({
    model: name,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });
}

function cleanJson(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

// Rate limits (429/quota) and temporary overload (503) are worth retrying
function isTransient(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes("429") ||
      err.message.includes("quota") ||
      err.message.includes("503") ||
      err.message.includes("overloaded") ||
      err.message.includes("high demand"))
  );
}

async function generate(prompt: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
    for (const name of GEMINI_MODELS) {
      try {
        const result = await getModel(name).generateContent(prompt);
        return result.response.text();
      } catch (err) {
        if (!isTransient(err)) throw err;
        console.log(`[gemini] ${name} unavailable — trying next`);
      }
    }
  }
  throw new Error("Our AI is at capacity right now. Please try again in a minute.");
}

function clampScore(value: unknown, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
  return Math.min(max, Math.max(0, n));
}

// Simple djb2-style hash for cache keys
function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return String(h >>> 0);
}

// Module-level cache: survives between requests in the same worker process.
const parseResumeCache = new Map<string, ParsedResume>();
const CACHE_MAX = 50;

export async function parseResume(rawText: string): Promise<ParsedResume> {
  const cacheKey = hashText(rawText);
  if (parseResumeCache.has(cacheKey)) {
    console.log("[gemini-extract] cache hit — skipping Gemini call");
    return parseResumeCache.get(cacheKey)!;
  }

  const t0 = Date.now();

  const prompt = `Extract a comprehensive semantic profile from this resume. Return JSON only:
{
  "skills": [],
  "implied_skills": [],
  "job_titles": [],
  "search_terms": [],
  "experience_years": 0,
  "industries": [],
  "achievements": []
}

Rules:
- skills: explicit skills, tools, technologies mentioned
- implied_skills: skills implied by experience, not just keywords. "managed team of 12" → ["leadership", "team management", "resource planning"]. "shipped product to 1M users" → ["product management", "scale", "execution"]. Read every sentence for INTENT.
- job_titles: all roles held
- search_terms: 3-5 BROAD, recruiter-standard job titles that would appear on Indeed or LinkedIn for this candidate. IGNORE niche internal jargon. Translate to standard market terms. Examples: "RAG pipelines, LLM orchestration" → ["AI engineer", "machine learning engineer", "software engineer"]. "Growth hacking, PLG" → ["growth engineer", "product manager", "marketing manager"]. Output the most hireable, searchable version of their role.
- experience_years: total years of professional experience (integer)
- industries: sectors worked in
- achievements: key accomplishments as plain statements

Resume:
${rawText}`;

  const raw = await generate(prompt);

  try {
    const parsed = JSON.parse(cleanJson(raw));
    const profile: ParsedResume = {
      rawText,
      skills: parsed.skills ?? [],
      implied_skills: parsed.implied_skills ?? [],
      job_titles: parsed.job_titles ?? [],
      search_terms: parsed.search_terms ?? [],
      experience_years: typeof parsed.experience_years === "number" ? parsed.experience_years : 0,
      industries: parsed.industries ?? [],
      achievements: parsed.achievements ?? [],
    };
    console.log(`[gemini-extract] ${Date.now() - t0}ms`);

    if (parseResumeCache.size >= CACHE_MAX) {
      parseResumeCache.delete(parseResumeCache.keys().next().value!);
    }
    parseResumeCache.set(cacheKey, profile);
    return profile;
  } catch {
    throw new Error(
      "Unable to parse your resume. Please ensure it contains readable text."
    );
  }
}

export async function scoreJobs(
  resume: ParsedResume,
  jobs: AdzunaJob[]
): Promise<ScoredJob[]> {
  if (jobs.length === 0) return [];

  const t0 = Date.now();

  const resumeProfile = {
    skills: resume.skills,
    implied_skills: resume.implied_skills,
    job_titles: resume.job_titles,
    experience_years: resume.experience_years,
    industries: resume.industries,
    achievements: resume.achievements,
  };

  // Send ALL jobs in a single Gemini call — no batching loop, no sleep.
  const jobDescriptions = jobs.map((job, idx) => ({
    index: idx,
    title: job.title,
    company: job.company,
    description: job.description.slice(0, 1500),
  }));

  const prompt = `You are a senior technical recruiter. Score how well this candidate matches each job.
DO NOT match keywords. Match MEANING and INTENT.

Rules:
- "Managed a team of 8" satisfies "team management required" → full credit
- "Built ML pipelines" satisfies "data engineering experience" → partial credit
- "Led product launches" satisfies "project management" → full credit
- "Reduced churn by 30%" satisfies "customer retention experience" → full credit
- "Built 0→1 product" satisfies "startup experience" → full credit
- Exact keyword missing but clear evidence of capability → give credit
- Keyword present but no evidence of actual use → partial credit only

Candidate profile:
${JSON.stringify(resumeProfile)}

Jobs to score (${jobs.length} jobs):
${JSON.stringify(jobDescriptions)}

Return a JSON array with exactly ${jobs.length} objects, one per job in the same order.
Fill the fields in this order — gather evidence first, then score from that evidence:
[
  {
    "index": 0,
    "matched": [],
    "missing": [],
    "skills_score": 0,
    "title_score": 0,
    "domain_score": 0,
    "reasoning": ""
  }
]

Fields:
- matched: requirements the candidate meets, as strings like "5 years Python → Python required"
- missing: requirements from the job description the candidate does NOT clearly meet (skills, seniority/years, domain, tools, location constraints). Be honest — most real jobs have at least one gap.
- skills_score: integer 0-50 — how much of the required skill set is covered
- title_score: integer 0-30 — seniority and role alignment (e.g. IC applying to a people-manager role, or 3 years vs 8+ required, loses points here)
- domain_score: integer 0-20 — industry / product-area fit
- reasoning: one sentence explaining the score; its tone must match the total (skills + title + domain)

Calibration:
- The total (skills + title + domain) is the match percentage. 85+ = near-perfect fit, 70-84 = strong, 50-69 = good with clear gaps, below 50 = partial.
- Award the maximum for a component only when there are no gaps for it in "missing".
- Each item in "missing" must reduce the relevant component score.
All scores must be integers, never floats.`;

  const raw = await generate(prompt);
  console.log(`[gemini-score-batch] ${Date.now() - t0}ms (${jobs.length} jobs)`);

  try {
    const scores = JSON.parse(cleanJson(raw));
    const scoresArray: Array<{
      index: number;
      skills_score: number;
      title_score: number;
      domain_score: number;
      matched: string[];
      missing: string[];
      reasoning: string;
    }> = Array.isArray(scores) ? scores : [scores];

    const scored: ScoredJob[] = scoresArray
      .filter((s) => jobs[s.index] != null)
      .map((s) => {
        const skills = clampScore(s.skills_score, 50);
        const title = clampScore(s.title_score, 30);
        const domain = clampScore(s.domain_score, 20);
        return {
          ...jobs[s.index],
          // Derived from the breakdown so the badge and the drawer can never disagree
          overall_score: skills + title + domain,
          skills_score: skills,
          title_score: title,
          domain_score: domain,
          matched: s.matched ?? [],
          missing: s.missing ?? [],
          reasoning: s.reasoning ?? "",
        };
      });

    // Fill in any jobs the model dropped
    const scoredIndexes = new Set(scoresArray.map((s) => s.index));
    jobs.forEach((job, idx) => {
      if (!scoredIndexes.has(idx)) {
        scored.push({
          ...job,
          overall_score: 0,
          skills_score: 0,
          title_score: 0,
          domain_score: 0,
          matched: [],
          missing: [],
          reasoning: "Score unavailable.",
        });
      }
    });

    return scored.sort((a, b) => b.overall_score - a.overall_score);
  } catch {
    // Fallback: return all jobs with 0 scores
    return jobs.map((job) => ({
      ...job,
      overall_score: 0,
      skills_score: 0,
      title_score: 0,
      domain_score: 0,
      matched: [],
      missing: [],
      reasoning: "Scoring temporarily unavailable — please try again.",
    }));
  }
}
