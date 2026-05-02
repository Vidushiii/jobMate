import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ParsedResume } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const { resume, filename } = (await request.json()) as { resume: ParsedResume; filename?: string };

    if (!resume?.rawText) {
      return Response.json({ error: "No resume data provided." }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      id: user.id,
      email: user.email ?? "",
      resume_text: resume.rawText,
    };

    // Store filename and upload timestamp in resume_url (pipe-separated)
    if (filename) {
      payload.resume_url = `${filename}|${new Date().toISOString()}`;
    }

    const { error } = await supabase.from("profiles").upsert(payload);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save profile.";
    return Response.json({ error: message }, { status: 500 });
  }
}
