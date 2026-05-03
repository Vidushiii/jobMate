"use client";

import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { ResumeDropzone } from "@/components/resume/ResumeDropzone";
import { ConsentModal } from "@/components/resume/ConsentModal";
import { JobList } from "@/components/jobs/JobList";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { AuthDashboard } from "@/components/dashboard/AuthDashboard";
import type { ParsedResume, AdzunaJob, ScoredJob, JobFilters } from "@/types";

const INDIAN_CITIES = [
  { label: "All India", value: "" },
  { label: "Bengaluru", value: "Bengaluru" },
  { label: "Mumbai", value: "Mumbai" },
  { label: "Delhi NCR", value: "Delhi NCR" },
  { label: "Hyderabad", value: "Hyderabad" },
  { label: "Pune", value: "Pune" },
  { label: "Chennai", value: "Chennai" },
  { label: "Gurgaon", value: "Gurgaon" },
  { label: "Noida", value: "Noida" },
  { label: "Kolkata", value: "Kolkata" },
  { label: "Ahmedabad", value: "Ahmedabad" },
  { label: "Remote (India)", value: "Remote" },
];

type Stage = "idle" | "consent" | "parsing" | "fetching" | "results" | "error";

const STAGE_INFO: Record<string, { label: string; detail: string }> = {
  parsing: {
    label: "Reading your resume",
    detail: "AI is extracting your skills and experience...",
  },
  fetching: {
    label: "Finding matches",
    detail: "Searching live listings and ranking by fit...",
  },
};

const PIPELINE_STAGES = ["parsing", "fetching"] as const;

// Unscored placeholder applied to raw Adzuna jobs before Gemini scores them
function toPlaceholder(j: AdzunaJob): ScoredJob {
  return {
    ...j,
    overall_score: -1,
    skills_score: -1,
    title_score: -1,
    domain_score: -1,
    matched: [],
    missing: [],
    reasoning: "",
  };
}

export default function HomePage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [jobs, setJobs] = useState<ScoredJob[]>([]);
  const [isScoringInProgress, setIsScoringInProgress] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Filter bar — staged (what's in the UI) vs applied (last search)
  const [filters, setFilters] = useState<JobFilters>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<JobFilters>({});
  const [appliedQuery, setAppliedQuery] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);

  const [authStatus, setAuthStatus] = useState<"loading" | "anonymous" | "authenticated">("loading");
  const [dashProfile, setDashProfile] = useState<{ full_name?: string; email: string; has_resume: boolean } | null>(null);

  // Refs
  const pipelineRef = useRef(0);
  // Page cache: cleared on every new search, populated per page
  const pageCacheRef = useRef<Map<number, ScoredJob[]>>(new Map());
  // Remembers the last search params so pagination can re-use them
  const lastSearchRef = useRef<{ customQuery: string | null; filters: JobFilters }>({
    customQuery: null,
    filters: {},
  });
  const jobListRef = useRef<HTMLDivElement>(null);

  // True when staged filters differ from what was last searched
  const isDirty =
    searchQuery !== appliedQuery ||
    (filters.location ?? "") !== (appliedFilters.location ?? "") ||
    (filters.jobType ?? "") !== (appliedFilters.jobType ?? "");

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAuthStatus("anonymous");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, resume_text")
        .eq("id", user.id)
        .single();
      setDashProfile({
        full_name: profile?.full_name ?? undefined,
        email: user.email ?? "",
        has_resume: !!profile?.resume_text,
      });
      setAuthStatus("authenticated");
    })();
  }, []);

  const scrollToJobList = () => {
    setTimeout(() => {
      jobListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  // Core fetch+score function used by initial pipeline, Apply button, and pagination.
  const handleSearch = async (
    customQuery: string | null,
    filterValues: JobFilters,
    page: number,
    providedResume?: ParsedResume
  ) => {
    const resume = providedResume ?? parsedResume;
    if (!resume && !customQuery) return;

    // Return cached page immediately — no network call
    if (pageCacheRef.current.has(page)) {
      setJobs(pageCacheRef.current.get(page)!);
      setCurrentPage(page);
      scrollToJobList();
      return;
    }

    const runId = ++pipelineRef.current;
    setIsScoringInProgress(false);
    setCurrentPage(page);

    try {
      const fetchStart = Date.now();
      const fetchBody = customQuery
        ? { customQuery, location: filterValues.location, jobType: filterValues.jobType, page }
        : {
            skills: [...(resume!.skills ?? []), ...(resume!.implied_skills ?? [])].slice(0, 10),
            role: resume!.job_titles[0] ?? "",
            search_terms: resume!.search_terms ?? [],
            location: filterValues.location,
            jobType: filterValues.jobType,
            page,
          };

      const fetchRes = await fetch("/api/fetch-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fetchBody),
      });

      if (!fetchRes.ok) {
        const { error } = await fetchRes.json();
        throw new Error(error ?? "Failed to fetch jobs.");
      }

      const { jobs: rawJobs, totalCount: count }: { jobs: AdzunaJob[]; totalCount: number } =
        await fetchRes.json();
      console.log(`[adzuna-client] ${Date.now() - fetchStart}ms — ${rawJobs.length} jobs (total: ${count})`);

      if (runId !== pipelineRef.current) return;
      setTotalCount(count);

      // Show raw jobs immediately with sentinel scores for progressive display
      if (rawJobs.length > 0) {
        setJobs(rawJobs.map(toPlaceholder));
        setStage("results");
        setIsScoringInProgress(true);
        scrollToJobList();
      } else {
        setJobs([]);
        setStage("results");
        return;
      }

      // Score all jobs in one Gemini call
      const scoreStart = Date.now();
      const scoreRes = await fetch("/api/score-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: resume ?? parsedResume, jobs: rawJobs }),
      });

      if (!scoreRes.ok) {
        const { error } = await scoreRes.json();
        throw new Error(error ?? "Failed to score jobs.");
      }

      const { jobs: scoredJobs } = await scoreRes.json();
      console.log(`[score-client] ${Date.now() - scoreStart}ms`);

      if (runId !== pipelineRef.current) return;
      pageCacheRef.current.set(page, scoredJobs);
      setJobs(scoredJobs);
      setIsScoringInProgress(false);
    } catch (err) {
      if (runId !== pipelineRef.current) return;
      setIsScoringInProgress(false);
      // If jobs are already visible (just scoring failed), keep them on screen silently
      if (stage === "results" && jobs.length > 0) return;
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
      setStage("error");
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setStage("consent");
  };

  const handleConsentCancel = () => {
    setSelectedFile(null);
    setStage("idle");
  };

  const runPipeline = async (file: File) => {
    pipelineRef.current++;
    pageCacheRef.current.clear();
    setIsScoringInProgress(false);
    setStage("parsing");
    const t0 = Date.now();

    try {
      const parseStart = Date.now();
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("consent_token", "user_consented");

      const parseRes = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });

      if (!parseRes.ok) {
        const { error } = await parseRes.json();
        throw new Error(error ?? "Failed to parse resume.");
      }

      const resume: ParsedResume = await parseRes.json();
      console.log(`[parse] ${Date.now() - parseStart}ms`);
      setParsedResume(resume);

      if (authStatus === "authenticated") {
        fetch("/api/save-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resume }),
        }).catch(() => {});
      }

      // Commit current filter state as the applied baseline for this search
      setAppliedFilters({ ...filters });
      setAppliedQuery("");
      lastSearchRef.current = { customQuery: null, filters: { ...filters } };

      setStage("fetching");
      await handleSearch(null, filters, 1, resume);
      console.log(`[total] ${Date.now() - t0}ms`);
    } catch (err) {
      setIsScoringInProgress(false);
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
      setStage("error");
    }
  };

  const handleConsentAccept = () => {
    if (selectedFile) runPipeline(selectedFile);
  };

  // Triggered only by "Apply" button click or Enter in search input
  const handleApply = () => {
    if (!parsedResume) return;
    const q = searchQuery.trim() || null;
    const f = { ...filters };

    setAppliedFilters(f);
    setAppliedQuery(searchQuery);
    lastSearchRef.current = { customQuery: q, filters: f };
    pageCacheRef.current.clear();
    setCurrentPage(1);
    setTotalCount(undefined);

    handleSearch(q, f, 1);
  };

  const handlePageChange = (newPage: number) => {
    const { customQuery, filters: lastFilters } = lastSearchRef.current;
    handleSearch(customQuery, lastFilters, newPage);
  };

  const handleClearResume = () => {
    pipelineRef.current++;
    pageCacheRef.current.clear();
    setSelectedFile(null);
    setParsedResume(null);
    setJobs([]);
    setStage("idle");
    setErrorMessage("");
    setIsScoringInProgress(false);
    setCurrentPage(1);
    setTotalCount(undefined);
    setFilters({});
    setSearchQuery("");
    setAppliedFilters({});
    setAppliedQuery("");
  };

  const isProcessing = PIPELINE_STAGES.includes(stage as typeof PIPELINE_STAGES[number]);
  const currentStageInfo = isProcessing ? STAGE_INFO[stage] : null;
  const cityLabel =
    INDIAN_CITIES.find((c) => c.value === (appliedFilters.location ?? ""))?.label ?? "All India";

  if (authStatus === "loading") {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (authStatus === "authenticated" && dashProfile) {
    return <AuthDashboard profile={dashProfile} />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Hero — visible only on idle */}
      {stage === "idle" && (
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-4">
            Find jobs that{" "}
            <span className="text-[#FF3E6C]">actually fit you</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Upload your resume. Our AI reads your experience — not just keywords
            — and ranks every job by how well it matches who you really are.
          </p>
        </div>
      )}

      {/* Sticky dropzone + filter bar */}
      <div className="sticky top-16 z-30 bg-white pb-4 pt-2">
        <ResumeDropzone
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
          onClear={handleClearResume}
          disabled={isProcessing}
        />

        {/* Single-row filter bar — shown once results are available */}
        {stage === "results" && parsedResume && (
          <div className="mt-3">
            <div className="flex gap-3 flex-wrap sm:flex-nowrap items-center">
              {/* Search input — full width on mobile, flex-1 on desktop */}
              <div className="relative flex-1 basis-full sm:basis-auto min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search jobs (e.g. product manager, react developer)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleApply();
                  }}
                  className="w-full h-10 pl-9 pr-4 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3E6C] focus:border-transparent"
                />
              </div>

              {/* Location dropdown */}
              <select
                value={filters.location ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
                className="flex-1 sm:flex-none sm:w-[140px] h-10 min-w-[100px] border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3E6C] bg-white"
              >
                {INDIAN_CITIES.map((city) => (
                  <option key={city.value} value={city.value}>
                    {city.label}
                  </option>
                ))}
              </select>

              {/* Work type dropdown */}
              <select
                value={filters.jobType ?? ""}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    jobType: e.target.value as JobFilters["jobType"],
                  }))
                }
                className="flex-1 sm:flex-none sm:w-[140px] h-10 min-w-[100px] border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3E6C] bg-white"
              >
                <option value="">All types</option>
                <option value="onsite">On-site</option>
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option>
              </select>

              {/* Apply button with dirty-state indicator */}
              <div className="relative shrink-0 flex-1 sm:flex-none">
                <button
                  onClick={handleApply}
                  disabled={isScoringInProgress}
                  className="w-full sm:w-[100px] h-10 rounded-lg text-sm font-semibold text-white bg-[#FF3E6C] hover:bg-[#e62e5c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Apply
                </button>
                {isDirty && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#FF3E6C] border-2 border-white animate-pulse" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Consent modal */}
      <ConsentModal
        isOpen={stage === "consent"}
        onAccept={handleConsentAccept}
        onCancel={handleConsentCancel}
      />

      {/* Processing state — initial pipeline only */}
      {isProcessing && currentStageInfo && (
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <Spinner size="lg" />
          <div className="text-center">
            <p className="text-base font-semibold text-gray-900">
              {currentStageInfo.label}
            </p>
            <p className="text-sm text-gray-500 mt-1">{currentStageInfo.detail}</p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-2 mt-2">
            {PIPELINE_STAGES.map((s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    stage === s
                      ? "bg-[#FF3E6C] scale-125"
                      : PIPELINE_STAGES.indexOf(stage as typeof PIPELINE_STAGES[number]) > i
                      ? "bg-green-500"
                      : "bg-gray-200"
                  }`}
                />
                {i < PIPELINE_STAGES.length - 1 && (
                  <div
                    className={`w-10 h-0.5 mx-1 transition-colors ${
                      PIPELINE_STAGES.indexOf(stage as typeof PIPELINE_STAGES[number]) > i
                        ? "bg-green-400"
                        : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex text-xs text-gray-400" style={{ gap: "2.5rem" }}>
            <span>Reading</span>
            <span>Finding</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {stage === "error" && (
        <div className="py-16 text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Search className="w-7 h-7 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Something went wrong
          </h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
            {errorMessage}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={handleClearResume}>
              Start over
            </Button>
            <Button
              onClick={() => {
                if (selectedFile) runPipeline(selectedFile);
              }}
            >
              Try again
            </Button>
          </div>
        </div>
      )}

      {/* Results */}
      {stage === "results" && (
        <div className="mt-6" ref={jobListRef}>
          {parsedResume && (
            <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-gray-900">
                    {jobs.length} job{jobs.length !== 1 ? "s" : ""} found
                    {totalCount && totalCount > jobs.length
                      ? ` of ${totalCount.toLocaleString()}`
                      : ""}
                  </h2>
                  {isScoringInProgress && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-[#FF3E6C] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF3E6C] animate-pulse" />
                      Scoring matches…
                    </span>
                  )}
                </div>
                {jobs.length > 0 && parsedResume.skills.length > 0 && (
                  <p className="text-sm text-gray-500">
                    Based on:{" "}
                    {parsedResume.skills.slice(0, 4).join(", ")}
                    {parsedResume.skills.length > 4 ? " and more" : ""}
                  </p>
                )}
              </div>
              {authStatus === "anonymous" && (
                <div className="bg-[#FFF0F3] border border-[#FF3E6C]/20 rounded-xl px-4 py-3 text-sm">
                  <a
                    href="/signup"
                    className="font-semibold text-[#FF3E6C] hover:underline"
                  >
                    Create a free account
                  </a>{" "}
                  <span className="text-gray-600">to save results & get alerts</span>
                </div>
              )}
            </div>
          )}
          <JobList
            jobs={jobs}
            resumeProcessed={true}
            cityName={cityLabel}
            totalCount={totalCount}
            page={currentPage}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Feature grid — shown on idle */}
      {stage === "idle" && (
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            {
              icon: "🧠",
              title: "AI understands intent",
              desc: "We match meaning, not keywords. Led a team? That counts for management roles even if you never typed 'manager'.",
            },
            {
              icon: "⚡",
              title: "Results in seconds",
              desc: "Upload your resume and get 20 live, ranked job matches in under 30 seconds.",
            },
            {
              icon: "🔒",
              title: "Private by default",
              desc: "No account needed. Your data stays in your session and is deleted automatically after 24 hours.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-gray-50 rounded-2xl p-6 text-center">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
