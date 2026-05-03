import type { AdzunaJob } from "@/types";

const BASE_URL = "https://api.adzuna.com/v1/api/jobs/in/search/1";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function fetchJobs(
  query: string,
  location?: string,
  page = 1
): Promise<{ jobs: AdzunaJob[]; totalCount: number }> {
  const appId = process.env.ADZUNA_APP_ID!;
  const appKey = process.env.ADZUNA_APP_KEY!;

  const effectiveQuery = query.trim() || "software engineer";

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "20",
    what: effectiveQuery,
  });

  if (location && location.trim()) {
    params.set("where", location.trim());
  }

  const pageBase = page > 1 ? BASE_URL.replace("/1", `/${page}`) : BASE_URL;
  const url = `${pageBase}?${params.toString()}`;

  console.log("[adzuna] country: in");
  console.log("[adzuna] what:", effectiveQuery);
  console.log("[adzuna] url:", url);

  const t0 = Date.now();
  const res = await fetch(url, {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.log("[adzuna] error response:", errorText);
    throw new Error(`Adzuna ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  const totalCount: number = data.count ?? 0;
  console.log(`[adzuna] ${Date.now() - t0}ms — ${data.results?.length ?? 0}/${totalCount} results for "${effectiveQuery}"`);
  const results = data.results ?? [];

  const jobs = results.map(
    (job: {
      id: string;
      title: string;
      company?: { display_name?: string };
      location?: { display_name?: string };
      description?: string;
      salary_min?: number;
      salary_max?: number;
      redirect_url?: string;
      created?: string;
    }) => ({
      id: String(job.id),
      title: job.title ?? "Untitled Position",
      company: job.company?.display_name ?? "Unknown Company",
      location: job.location?.display_name ?? "Location not specified",
      description: stripHtml(job.description ?? ""),
      salaryMin: job.salary_min ?? undefined,
      salaryMax: job.salary_max ?? undefined,
      url: job.redirect_url ?? "",
      postedAt: job.created ?? new Date().toISOString(),
      logoUrl: undefined,
    })
  );

  return { jobs, totalCount };
}
