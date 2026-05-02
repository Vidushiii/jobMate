"use client";

import { useEffect, useRef } from "react";
import { X, ExternalLink, MapPin, Building2 } from "lucide-react";
import type { ScoredJob } from "@/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MatchScoreBadge } from "./MatchScoreBadge";

interface SkillGapDrawerProps {
  job: ScoredJob | null;
  onClose: () => void;
}

export function SkillGapDrawer({ job, onClose }: SkillGapDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (job) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [job, onClose]);

  if (!job) return null;

  const handleApply = () => {
    window.open(job.url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-white z-50 shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`Job details: ${job.title}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-lg font-bold text-gray-900 leading-tight">
              {job.title}
            </h2>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <Building2 className="w-4 h-4" />
                {job.company}
              </span>
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <MapPin className="w-4 h-4" />
                {job.location}
              </span>
            </div>
            <div className="mt-3">
              <MatchScoreBadge score={job.overall_score} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* AI Reasoning */}
          {job.reasoning && (
            <div className="bg-[#FFF0F3] rounded-xl p-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                <span className="font-semibold text-[#FF3E6C]">AI summary: </span>
                {job.reasoning}
              </p>
            </div>
          )}

          {/* Score breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Score breakdown</h3>
            <div className="space-y-2">
              {[
                { label: "Skills match", value: job.skills_score, max: 50 },
                { label: "Role alignment", value: job.title_score, max: 30 },
                { label: "Industry fit", value: job.domain_score, max: 20 },
              ].map(({ label, value, max }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{label}</span>
                    <span>{value}/{max}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#FF3E6C] rounded-full transition-all"
                      style={{ width: `${(value / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Matched skills */}
          {job.matched.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Skills you have ({job.matched.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {job.matched.map((skill, i) => (
                  <Badge key={i} variant="green">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Missing skills */}
          {job.missing.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full" />
                Skills to develop ({job.missing.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {job.missing.map((skill, i) => (
                  <Badge key={i} variant="amber">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Salary */}
          {(job.salaryMin || job.salaryMax) && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Estimated salary</p>
              <p className="text-sm font-semibold text-gray-900">
                {job.salaryMin && job.salaryMax
                  ? `$${job.salaryMin.toLocaleString()} – $${job.salaryMax.toLocaleString()}`
                  : job.salaryMin
                  ? `From $${job.salaryMin.toLocaleString()}`
                  : `Up to $${job.salaryMax!.toLocaleString()}`}
              </p>
            </div>
          )}

          {/* Job description */}
          {job.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                About the role
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line line-clamp-[12]">
                {job.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="p-6 border-t border-gray-100 shrink-0">
          <Button onClick={handleApply} className="w-full" size="lg">
            <ExternalLink className="w-4 h-4" />
            Apply Now
          </Button>
        </div>
      </div>
    </>
  );
}
