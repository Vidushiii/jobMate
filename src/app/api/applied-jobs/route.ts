import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { job_id, job_title, company, job_url } = body as {
      job_id: string;
      job_title: string;
      company: string;
      job_url: string;
    };

    const { error } = await supabase.from("applied_jobs").upsert(
      { user_id: user.id, job_id, job_title, company, job_url },
      { onConflict: "user_id,job_id", ignoreDuplicates: true }
    );

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save application.";
    return Response.json({ error: message }, { status: 500 });
  }
}
