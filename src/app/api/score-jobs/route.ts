import { NextRequest } from "next/server";
import { scoreJobs } from "@/lib/gemini";
import type { ParsedResume, AdzunaJob } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resume, jobs } = body as {
      resume: ParsedResume;
      jobs: AdzunaJob[];
    };

    if (!resume || !jobs || !Array.isArray(jobs)) {
      return Response.json(
        { error: "Invalid request. Resume and jobs are required." },
        { status: 400 }
      );
    }

    if (jobs.length === 0) {
      return Response.json({ jobs: [] });
    }

    const scored = await scoreJobs(resume, jobs);
    return Response.json({ jobs: scored });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to score jobs.";
    return Response.json({ error: message }, { status: 500 });
  }
}
