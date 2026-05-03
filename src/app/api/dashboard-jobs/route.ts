import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseResume, scoreJobs } from "@/lib/gemini";
import { fetchJobs } from "@/lib/adzuna";
import type { AdzunaJob } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    let customQuery: string | undefined;
    let location: string | undefined;
    let workType: string | undefined;

    try {
      const body = await request.json();
      customQuery = body.customQuery;
      location = body.location;
      workType = body.workType;
    } catch {
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, resume_text")
      .eq("id", user.id)
      .single();

    if (!profile?.resume_text) {
      return Response.json({
        jobs: [],
        hasResume: false,
        parsedResume: null,
        appliedJobIds: [],
      });
    }

    const parsedResume = await parseResume(profile.resume_text);

    let queryTerms: string[];
    if (customQuery) {
      queryTerms = [customQuery];
    } else {
      const fallback = [parsedResume.job_titles[0], ...parsedResume.skills.slice(0, 5)]
        .filter(Boolean)
        .join(" ");
      queryTerms = [...parsedResume.search_terms, fallback].filter(Boolean);
    }

    const applyWorkType = (term: string) => {
      if (workType === "remote") return `${term} remote`;
      if (workType === "hybrid") return `${term} hybrid`;
      return term;
    };

    let rawJobs: AdzunaJob[] = [];
    for (const term of queryTerms) {
      const effectiveTerm = applyWorkType(term);
      const { jobs: fetched } = await fetchJobs(effectiveTerm, location || undefined);
      if (fetched.length > 0) {
        rawJobs = fetched;
        break;
      }
    }

    const scoredJobs = await scoreJobs(parsedResume, rawJobs);

    const jobIds = scoredJobs.map((j) => j.id);
    const { data: appliedRows } = await supabase
      .from("applied_jobs")
      .select("job_id")
      .eq("user_id", user.id)
      .in("job_id", jobIds);

    const appliedSet = new Set((appliedRows ?? []).map((r) => r.job_id));

    const jobs = scoredJobs.map((j) => ({ ...j, applied: appliedSet.has(j.id) }));

    return Response.json({
      jobs,
      hasResume: true,
      parsedResume,
      appliedJobIds: [...appliedSet],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load jobs.";
    return Response.json({ error: message }, { status: 500 });
  }
}
