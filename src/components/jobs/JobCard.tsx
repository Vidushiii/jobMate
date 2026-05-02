"use client";

import { useState } from "react";
import { MapPin, Building2, Calendar, ExternalLink, Check } from "lucide-react";
import type { ScoredJob } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MatchScoreBadge } from "./MatchScoreBadge";

interface JobCardProps {
  job: ScoredJob;
  rank: number;
  onViewDetails: (job: ScoredJob) => void;
  onApply?: (job: ScoredJob) => void;
  onUndoApply?: (jobId: string) => void;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function formatSalary(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

export function JobCard({ job, rank, onViewDetails, onApply, onUndoApply }: JobCardProps) {
  const [showUndoPopover, setShowUndoPopover] = useState(false);
  const salary = formatSalary(job.salaryMin, job.salaryMax);
  const topMatched = job.matched.slice(0, 3);

  return (
    <Card className="p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Rank + title */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-gray-300 tabular-nums w-5">
              #{rank}
            </span>
            <h3 className="text-base font-bold text-gray-900 leading-tight truncate">
              {job.title}
            </h3>
          </div>

          {/* Company / location */}
          <div className="flex items-center gap-3 flex-wrap ml-7">
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              {job.company}
            </span>
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              {job.location}
            </span>
            {salary && (
              <span className="text-sm font-medium text-gray-700">{salary}</span>
            )}
          </div>
        </div>

        <MatchScoreBadge score={job.overall_score} size="sm" />
      </div>

      {/* Reasoning */}
      {job.reasoning && (
        <p className="mt-3 text-xs text-gray-500 leading-relaxed line-clamp-2">
          {job.reasoning}
        </p>
      )}

      {/* Matched skill pills */}
      {topMatched.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {topMatched.map((skill, i) => (
            <Badge key={i} variant="green">
              {skill}
            </Badge>
          ))}
          {job.matched.length > 3 && (
            <Badge variant="gray">+{job.matched.length - 3} more</Badge>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Calendar className="w-3 h-3" />
          {formatDate(job.postedAt)}
        </span>

        <div className="flex gap-2 items-center">
          <Button variant="outline" size="sm" onClick={() => onViewDetails(job)}>
            View details
          </Button>

          {onApply ? (
            job.applied ? (
              <div className="relative">
                <button
                  onClick={() => setShowUndoPopover((v) => !v)}
                  title="Click to undo if you didn't actually apply"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold border border-green-200 hover:bg-green-100 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Applied
                </button>
                {showUndoPopover && (
                  <div className="absolute bottom-full right-0 mb-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-20">
                    <p className="text-sm font-medium text-gray-800 mb-1">Undo application?</p>
                    <p className="text-xs text-gray-500 mb-3">Did you not actually apply?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowUndoPopover(false)}
                        className="flex-1 text-xs text-gray-500 hover:text-gray-700 py-1.5 rounded-lg border border-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          onUndoApply?.(job.id);
                          setShowUndoPopover(false);
                        }}
                        className="flex-1 text-xs font-semibold text-red-600 hover:text-red-700 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        Yes, undo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  window.open(job.url, "_blank", "noopener,noreferrer");
                  onApply(job);
                }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Apply
              </Button>
            )
          ) : (
            <Button
              size="sm"
              onClick={() => window.open(job.url, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Apply
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
