import { NextRequest } from "next/server";
import { extractTextFromBuffer } from "@/lib/pdf-parser";
import { parseResume } from "@/lib/gemini";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("resume");
    const consentToken = formData.get("consent_token");

    if (!consentToken || consentToken.toString() !== "user_consented") {
      return Response.json(
        { error: "Consent is required before processing your resume." },
        { status: 403 }
      );
    }

    if (!file || !(file instanceof File)) {
      return Response.json(
        { error: "No resume file provided. Please select a PDF or DOCX file." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        { error: "Invalid file type. Please upload a PDF or DOCX file only." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return Response.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = await extractTextFromBuffer(buffer, file.type);

    if (!rawText || rawText.length < 100) {
      return Response.json(
        {
          error:
            "Your resume appears to be empty or unreadable. Please try a different file.",
        },
        { status: 422 }
      );
    }

    const parsed = await parseResume(rawText);
    return Response.json(parsed);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to process resume.";
    return Response.json({ error: message }, { status: 500 });
  }
}
