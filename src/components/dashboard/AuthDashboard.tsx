"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Toast, useToast } from "@/components/ui/Toast";
import { JobList } from "@/components/jobs/JobList";
import type { ScoredJob, ParsedResume } from "@/types";

interface DashboardProfile {
  full_name?: string;
  email: string;
  has_resume: boolean;
}

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

const WORK_TYPES = [
  { label: "All", value: "" },
  { label: "On-site", value: "onsite" },
  { label: "Hybrid", value: "hybrid" },
  { label: "Remote", value: "remote" },
] as const;

export function AuthDashboard({ profile }: { profile: DashboardProfile }) {
  const [jobs, setJobs] = useState<ScoredJob[]>([]);
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(profile.has_resume);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [city, setCity] = useState("");
  const [workType, setWorkType] = useState<"" | "onsite" | "hybrid" | "remote">("");

  const { toast, show: showToast, hide: hideToast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parsedResumeRef = useRef<ParsedResume | null>(null);
  const appliedRef = useRef<Set<string>>(new Set());

  const loadInitialJobs = async (loc: string, wt: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: loc, workType: wt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load jobs.");
        return;
      }
      setJobs(data.jobs ?? []);
      setParsedResume(data.parsedResume ?? null);
      parsedResumeRef.current = data.parsedResume ?? null;
      const appliedSet = new Set<string>(data.appliedJobIds ?? []);
      setAppliedJobIds(appliedSet);
      appliedRef.current = appliedSet;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const runCustomSearch = async (query: string, loc: string, wt: string) => {
    if (!parsedResumeRef.current) {
      await loadInitialJobs(loc, wt);
      return;
    }
    setSearching(true);
    setError("");
    try {
      const fetchRes = await fetch("/api/fetch-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customQuery: query || undefined,
          search_terms: parsedResumeRef.current.search_terms,
          skills: parsedResumeRef.current.skills,
          role: parsedResumeRef.current.job_titles[0] ?? "",
          location: loc,
          jobType: wt || undefined,
        }),
      });
      const fetchData = await fetchRes.json();
      const rawJobs = fetchData.jobs ?? [];

      let scoredJobs: ScoredJob[] = rawJobs;
      if (rawJobs.length > 0 && parsedResumeRef.current) {
        const scoreRes = await fetch("/api/score-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resume: parsedResumeRef.current, jobs: rawJobs }),
        });
        const scoreData = await scoreRes.json();
        scoredJobs = scoreData.jobs ?? rawJobs;
      }

      const withApplied = scoredJobs.map((j) => ({
        ...j,
        applied: appliedRef.current.has(j.id),
      }));
      setJobs(withApplied);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const capturedCity = city;
    const capturedWorkType = workType;
    debounceRef.current = setTimeout(() => {
      if (!value) {
        loadInitialJobs(capturedCity, capturedWorkType);
      } else {
        runCustomSearch(value, capturedCity, capturedWorkType);
      }
    }, 2000);
  };

  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim()) {
      runCustomSearch(searchQuery, newCity, workType);
    } else {
      loadInitialJobs(newCity, workType);
    }
  };

  const handleWorkTypeChange = (newWt: string) => {
    setWorkType(newWt as "" | "onsite" | "hybrid" | "remote");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim()) {
      runCustomSearch(searchQuery, city, newWt);
    } else {
      loadInitialJobs(city, newWt);
    }
  };

  const handleApply = async (job: ScoredJob) => {
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, applied: true } : j)));
    const newSet = new Set(appliedRef.current);
    newSet.add(job.id);
    setAppliedJobIds(newSet);
    appliedRef.current = newSet;

    try {
      const res = await fetch("/api/applied-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: job.id,
          job_title: job.title,
          company: job.company,
          job_url: job.url,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed");
      }
    } catch {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, applied: false } : j)));
      const rollback = new Set(appliedRef.current);
      rollback.delete(job.id);
      setAppliedJobIds(rollback);
      appliedRef.current = rollback;
      showToast("Failed to save application.", "error");
    }
  };

  const handleUndoApply = async (jobId: string) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, applied: false } : j)));
    const newSet = new Set(appliedRef.current);
    newSet.delete(jobId);
    setAppliedJobIds(newSet);
    appliedRef.current = newSet;

    try {
      const res = await fetch(`/api/applied-jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed");
      }
    } catch {
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, applied: true } : j)));
      const rollback = new Set(appliedRef.current);
      rollback.add(jobId);
      setAppliedJobIds(rollback);
      appliedRef.current = rollback;
      showToast("Failed to undo. Please try again.", "error");
    }
  };

  useEffect(() => {
    if (profile.has_resume) {
      loadInitialJobs("", "");
    }
  }, []);

  const displayName = profile.full_name || profile.email.split("@")[0];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Hi, {displayName}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Here are the jobs best suited to your profile
        </p>
      </div>

      <div className="sticky top-16 z-30 bg-white pb-4 pt-1 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search jobs (e.g. product manager, react developer)"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && debounceRef.current) {
                    clearTimeout(debounceRef.current);
                    if (searchQuery.trim()) runCustomSearch(searchQuery, city, workType);
                    else loadInitialJobs(city, workType);
                  }
                }}
                className="w-full pl-9 pr-4 h-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3E6C] focus:border-transparent"
              />
            </div>

            <div className="flex gap-2 flex-wrap sm:flex-nowrap items-center">
              <select
                value={city}
                onChange={(e) => handleCityChange(e.target.value)}
                className="h-10 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3E6C] bg-white"
              >
                {INDIAN_CITIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>

              <div className="flex gap-1.5">
                {WORK_TYPES.map((wt) => (
                  <button
                    key={wt.value}
                    onClick={() => handleWorkTypeChange(wt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      workType === wt.value
                        ? "bg-[#FF3E6C] text-white"
                        : "border border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {wt.label}
                  </button>
                ))}
              </div>

            </div>
          </div>
        </div>
      </div>

      {!profile.has_resume && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3">
          <span>Upload your resume to see personalized matches.</span>
          <Link
            href="/profile"
            className="font-semibold text-amber-900 hover:underline whitespace-nowrap"
          >
            Go to Profile
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={() => loadInitialJobs(city, workType)}
            className="font-semibold text-red-800 hover:underline whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !searching && jobs.length > 0 && (
        <p className="text-sm text-gray-500 mb-4">{jobs.length} matches for your profile</p>
      )}

      <JobList
        jobs={jobs}
        isLoading={loading || searching}
        resumeProcessed={profile.has_resume}
        cityName={INDIAN_CITIES.find((c) => c.value === city)?.label}
        onApply={handleApply}
        onUndoApply={handleUndoApply}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  );
}
