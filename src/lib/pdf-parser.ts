export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  let text = "";

  try {
    if (mimeType === "application/pdf") {
      const { default: pdfParse } = await import("pdf-parse-fork");
      const data = await pdfParse(buffer);
      text = data.text ?? "";
    } else if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      throw new Error("Unsupported file type. Please upload a PDF or DOCX file.");
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Unsupported")) throw err;
    throw new Error(
      "We couldn't read this file. Make sure it's a valid PDF or DOCX and try again."
    );
  }

  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (normalized.length < 100) {
    throw new Error(
      "We couldn't read this resume. It may be a scanned image — try a text-based PDF or DOCX."
    );
  }

  return normalized;
}
