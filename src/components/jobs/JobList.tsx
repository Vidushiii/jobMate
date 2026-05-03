"use client";

import { useState } from "react";
import type { ScoredJob } from "@/types";
import { JobCard } from "./JobCard";
import { SkillGapDrawer } from "./SkillGapDrawer";
import { Lightbulb, ChevronLeft, ChevronRight } from "lucide-react";

interface JobListProps {
  jobs: ScoredJob[];
  isLoading?: boolean;
  resumeProcessed?: boolean;
  cityName?: string;
  totalCount?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  onApply?: (job: ScoredJob) => void;
  onUndoApply?: (jobId: string) => void;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="skeleton h-5 w-3/4 rounded" />
          <div className="skeleton h-4 w-1/2 rounded" />
        </div>
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="skeleton h-3 w-full rounded mt-3" />
      <div className="skeleton h-3 w-2/3 rounded mt-2" />
      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="ml-auto flex gap-2">
          <div className="skeleton h-8 w-24 rounded-lg" />
          <div className="skeleton h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ variant, cityName }: { variant: "no-resume" | "no-jobs"; cityName?: string }) {
  if (variant === "no-resume") {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lightbulb className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Upload your resume to find matches
        </h3>
        <p className="text-gray-500 text-sm max-w-sm mx-auto">
          Drop your PDF or DOCX resume above and our AI will find the best
          matching jobs for your skills.
        </p>
      </div>
    );
  }

  const isAllIndia = !cityName || cityName === "All India";
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Lightbulb className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {isAllIndia
          ? "No matches found"
          : `No matches in ${cityName}`}
      </h3>
      <p className="text-gray-500 text-sm max-w-sm mx-auto">
        {isAllIndia
          ? "No results for this search. Try a different role or use the search bar above."
          : `No matches in ${cityName}. Try selecting 'All India' or a different role.`}
      </p>
    </div>
  );
}

function getPageNumbers(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (page > 3) pages.push("…");
  const lo = Math.max(2, page - 1);
  const hi = Math.min(total - 1, page + 1);
  for (let i = lo; i <= hi; i++) pages.push(i);
  if (page < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const btnBase =
    "h-8 w-8 flex items-center justify-center rounded-lg text-sm font-medium border transition-colors";

  return (
    <div className="flex items-center justify-center gap-1.5 mt-8">
      <button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={`${btnBase} border-gray-200 text-gray-500 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed`}
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {getPageNumbers(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="w-8 text-center text-sm text-gray-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            className={`${btnBase} ${
              p === page
                ? "bg-[#FF3E6C] border-[#FF3E6C] text-white"
                : "border-gray-200 text-gray-600 hover:border-[#FF3E6C] hover:text-[#FF3E6C]"
            }`}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={`${btnBase} border-gray-200 text-gray-500 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed`}
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export function JobList({
  jobs,
  isLoading = false,
  resumeProcessed = false,
  cityName,
  totalCount,
  page = 1,
  onPageChange,
  onApply,
  onUndoApply,
}: JobListProps) {
  const [selectedJob, setSelectedJob] = useState<ScoredJob | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return <EmptyState variant={resumeProcessed ? "no-jobs" : "no-resume"} cityName={cityName} />;
  }

  const ITEMS_PER_PAGE = 20;
  const totalPages = totalCount
    ? Math.ceil(totalCount / ITEMS_PER_PAGE)
    : Math.ceil(jobs.length / ITEMS_PER_PAGE);

  const allUnscored = jobs.every((j) => j.overall_score === -1);
  const scoredJobs = allUnscored
    ? jobs
    : [...jobs].sort((a, b) => b.overall_score - a.overall_score);

  const bestScore = allUnscored
    ? -1
    : Math.max(...jobs.map((j) => j.overall_score));
  const heading =
    allUnscored
      ? ""
      : bestScore >= 70
      ? "Top matches"
      : bestScore >= 50
      ? "Best available matches"
      : "Closest matches we found";
  const showTips = !allUnscored && bestScore < 70;

  return (
    <>
      {heading && (
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          {heading}
        </p>
      )}

      <div className="space-y-4">
        {scoredJobs.map((job, i) => (
          <JobCard
            key={job.id}
            job={job}
            rank={(page - 1) * ITEMS_PER_PAGE + i + 1}
            onViewDetails={setSelectedJob}
            onApply={onApply}
            onUndoApply={onUndoApply}
          />
        ))}
      </div>

      {showTips && (
        <div className="bg-amber-50 rounded-xl p-5 mt-6">
          <p className="text-sm font-semibold text-amber-800 mb-3">
            Want better matches? Try these tips:
          </p>
          <ul className="space-y-2 text-sm text-amber-700">
            <li className="flex items-start gap-2">
              <span className="mt-0.5">•</span>
              Add more specific technical skills to your resume
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">•</span>
              Include quantifiable achievements (e.g., &ldquo;reduced load time by 40%&rdquo;)
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">•</span>
              Try adjusting the location filter or job type
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5">•</span>
              Make sure your resume has clear job titles and employment dates
            </li>
          </ul>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <PaginationBar page={page} totalPages={totalPages} onPageChange={onPageChange} />
      )}

      <SkillGapDrawer
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
      />
    </>
  );
}
