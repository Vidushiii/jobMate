import { NextRequest } from "next/server";
import { fetchJobs } from "@/lib/adzuna";
import type { AdzunaJob } from "@/types";
import { z } from "zod";

const schema = z.object({
  skills: z.array(z.string()).default([]),
  role: z.string().optional().default(""),
  search_terms: z.array(z.string()).default([]),
  customQuery: z.string().optional(),
  location: z.string().optional(),
  jobType: z.enum(["remote", "hybrid", "onsite", ""]).optional(),
  page: z.number().int().min(1).max(10).optional().default(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }

    const { skills, role, search_terms, customQuery, location, jobType, page } = parsed.data;

    const applyJobType = (term: string) =>
      jobType === "remote" ? `${term} remote`.trim() : term;

    // Manual query — use directly, no retry loop
    if (customQuery && customQuery.trim()) {
      const { jobs, totalCount } = await fetchJobs(applyJobType(customQuery.trim()), location, page);
      return Response.json({ jobs, totalCount });
    }

    // AI search: try each search_term in order, fall back to skills+role
    const fallbackQuery = [role, ...skills.slice(0, 5)].filter(Boolean).join(" ");
    const queryTerms = [...search_terms, fallbackQuery].filter(Boolean);

    let jobs: AdzunaJob[] = [];
    let totalCount = 0;
    for (const term of queryTerms) {
      const effectiveTerm = applyJobType(term);
      console.log("[fetch-jobs] trying query:", effectiveTerm);
      const result = await fetchJobs(effectiveTerm, location, page);

      if (result.jobs.length > 0) {
        jobs = result.jobs;
        totalCount = result.totalCount;
        console.log("[fetch-jobs] got", jobs.length, "results for:", effectiveTerm);
        break;
      }

      console.log("[fetch-jobs] 0 results for:", effectiveTerm, "— trying next");
    }

    return Response.json({ jobs, totalCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch jobs.";
    return Response.json({ error: message }, { status: 500 });
  }
}
