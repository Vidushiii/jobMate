import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ParsedResume, AdzunaJob, ScoredJob } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function getModel() {
  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });
}

function cleanJson(raw: string): string {
  // Strip markdown code fences if Gemini wraps the JSON
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

function isRateLimit(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes("429") || err.message.includes("quota"))
  );
}

async function callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isRateLimit(err)) throw err;
  }
  // 429 on first attempt — wait 2s and retry once
  await new Promise((r) => setTimeout(r, 2000));
  try {
    return await fn();
  } catch (err) {
    if (isRateLimit(err)) {
      throw new Error(
        "Our AI is at capacity right now. Please try again in a minute."
      );
    }
    throw err;
  }
}

export async function parseResume(rawText: string): Promise<ParsedResume> {
  const model = getModel();

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

  const result = await callWithRetry(() => model.generateContent(prompt));
  const raw = result.response.text();

  try {
    const parsed = JSON.parse(cleanJson(raw));
    return {
      rawText,
      skills: parsed.skills ?? [],
      implied_skills: parsed.implied_skills ?? [],
      job_titles: parsed.job_titles ?? [],
      search_terms: parsed.search_terms ?? [],
      experience_years: typeof parsed.experience_years === "number" ? parsed.experience_years : 0,
      industries: parsed.industries ?? [],
      achievements: parsed.achievements ?? [],
    };
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

  const model = getModel();
  const BATCH_SIZE = 10;
  const scored: ScoredJob[] = [];

  const resumeProfile = {
    skills: resume.skills,
    implied_skills: resume.implied_skills,
    job_titles: resume.job_titles,
    experience_years: resume.experience_years,
    industries: resume.industries,
    achievements: resume.achievements,
  };

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    if (i > 0) await new Promise((r) => setTimeout(r, 4000));

    const batch = jobs.slice(i, i + BATCH_SIZE);

    const jobDescriptions = batch.map((job, idx) => ({
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

Jobs to score (${batch.length} jobs):
${JSON.stringify(jobDescriptions)}

Return a JSON array with exactly ${batch.length} objects, one per job in the same order:
[
  {
    "index": 0,
    "overall_score": 0,
    "skills_score": 0,
    "title_score": 0,
    "domain_score": 0,
    "matched": [],
    "missing": [],
    "reasoning": ""
  }
]

Scoring weights:
- overall_score: integer 0-100
- skills_score: integer 0-50 (weighted 50%)
- title_score: integer 0-30 (seniority + role alignment, weighted 30%)
- domain_score: integer 0-20 (industry fit, weighted 20%)
- matched: array of strings like "5 years Python → Python required"
- missing: array of strings describing genuinely absent skills
- reasoning: one sentence explaining the score
All scores must be integers, never floats.`;

    const result = await callWithRetry(() => model.generateContent(prompt));
    const raw = result.response.text();

    try {
      const scores = JSON.parse(cleanJson(raw));
      const scoresArray = Array.isArray(scores) ? scores : [scores];

      scoresArray.forEach((score: {
        index: number;
        overall_score: number;
        skills_score: number;
        title_score: number;
        domain_score: number;
        matched: string[];
        missing: string[];
        reasoning: string;
      }) => {
        const job = batch[score.index];
        if (!job) return;
        scored.push({
          ...job,
          overall_score: Math.round(score.overall_score ?? 0),
          skills_score: Math.round(score.skills_score ?? 0),
          title_score: Math.round(score.title_score ?? 0),
          domain_score: Math.round(score.domain_score ?? 0),
          matched: score.matched ?? [],
          missing: score.missing ?? [],
          reasoning: score.reasoning ?? "",
        });
      });
    } catch {
      // Fallback: include jobs with 0 score
      batch.forEach((job) => {
        scored.push({
          ...job,
          overall_score: 0,
          skills_score: 0,
          title_score: 0,
          domain_score: 0,
          matched: [],
          missing: [],
          reasoning: "Scoring temporarily unavailable — please try again.",
        });
      });
    }
  }

  return scored.sort((a, b) => b.overall_score - a.overall_score);
}
