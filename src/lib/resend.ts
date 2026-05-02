import { Resend } from "resend";
import type { ScoredJob } from "@/types";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendJobMatchEmail(
  to: string,
  name: string,
  jobs: ScoredJob[]
): Promise<void> {
  const top5 = jobs.slice(0, 5);

  const jobRows = top5
    .map(
      (job) => `
    <tr>
      <td style="padding: 16px; border-bottom: 1px solid #f3f4f6;">
        <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${job.title}</div>
        <div style="color: #6b7280; font-size: 14px;">${job.company} · ${job.location}</div>
        <div style="margin-top: 8px;">
          <span style="background: #FFF0F3; color: #FF3E6C; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 500;">
            ${job.overall_score}% match
          </span>
        </div>
        <div style="margin-top: 8px; color: #6b7280; font-size: 13px;">${job.reasoning}</div>
        <div style="margin-top: 10px;">
          <a href="${job.url}" style="background: #FF3E6C; color: white; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 500;">
            Apply Now →
          </a>
        </div>
      </td>
    </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin: 0; padding: 0; background: #f9fafb; font-family: ui-sans-serif, system-ui, sans-serif;">
  <div style="max-width: 600px; margin: 32px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #FF3E6C; padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">JobMate</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 15px;">Your daily job matches are ready</p>
    </div>

    <div style="padding: 32px;">
      <p style="color: #374151; margin: 0 0 24px;">Hi ${name},</p>
      <p style="color: #374151; margin: 0 0 24px;">
        We found ${jobs.length} new job${jobs.length !== 1 ? "s" : ""} matching your profile. Here are your top picks:
      </p>

      <table style="width: 100%; border-collapse: collapse; border: 1px solid #f3f4f6; border-radius: 12px; overflow: hidden;">
        <tbody>
          ${jobRows}
        </tbody>
      </table>

      <div style="text-align: center; margin-top: 32px;">
        <a href="${process.env.NEXT_PUBLIC_SUPABASE_URL ? "https://jobmate.app/notifications" : "http://localhost:3000/notifications"}"
           style="background: #FF3E6C; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600;">
          View all ${jobs.length} matches
        </a>
      </div>
    </div>

    <div style="padding: 24px 32px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 13px; text-align: center;">
      You're receiving this because you enabled job notifications on JobMate.
      <br>
      <a href="#" style="color: #FF3E6C; text-decoration: none;">Manage notifications</a>
    </div>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from: "JobMate <noreply@jobmate.app>",
    to,
    subject: `${jobs.length} new job match${jobs.length !== 1 ? "es" : ""} — ${top5[0]?.overall_score}% top score`,
    html,
  });
}
