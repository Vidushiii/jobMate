"use client";

import { useState } from "react";
import type { ScoredJob } from "@/types";
import { JobCard } from "./JobCard";
import { SkillGapDrawer } from "./SkillGapDrawer";
import { Lightbulb, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

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

function EmptyState({ variant, cityName }: { variant: "no-resume" | "no-jobs" | "low-scores"; cityName?: string }) {
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

  if (variant === "no-jobs") {
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

  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Lightbulb className="w-8 h-8 text-amber-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        No strong matches found
      </h3>
      <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
        None of the available jobs scored above 40% for your profile.
      </p>
      <div className="bg-amber-50 rounded-xl p-5 max-w-sm mx-auto text-left">
        <p className="text-sm font-semibold text-amber-800 mb-3">
          Tips to improve your matches:
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

  const hasLowScores = jobs.every((j) => j.overall_score < 40);
  if (hasLowScores) {
    return <EmptyState variant="low-scores" cityName={cityName} />;
  }

  const ITEMS_PER_PAGE = 20;
  const totalPages = totalCount
    ? Math.ceil(totalCount / ITEMS_PER_PAGE)
    : Math.ceil(jobs.length / ITEMS_PER_PAGE);

  return (
    <>
      <div className="space-y-4">
        {jobs.map((job, i) => (
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

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <SkillGapDrawer
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
      />
    </>
  );
}
