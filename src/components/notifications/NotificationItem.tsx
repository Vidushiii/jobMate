"use client";

import { useState } from "react";
import { ExternalLink, CheckCircle, Eye, Briefcase } from "lucide-react";
import type { Notification } from "@/types";
import { MatchScoreBadge } from "@/components/jobs/MatchScoreBadge";

interface NotificationItemProps {
  notification: Notification;
  onStatusChange: (id: string, status: Notification["status"]) => void;
}

const STATUS_OPTIONS: { value: Notification["status"]; label: string }[] = [
  { value: "new", label: "New" },
  { value: "viewed", label: "Viewed" },
  { value: "applied", label: "Applied" },
];

function StatusBadge({ status }: { status: Notification["status"] }) {
  const styles = {
    new: "bg-blue-50 text-blue-700",
    viewed: "bg-gray-100 text-gray-600",
    applied: "bg-green-50 text-green-700",
  };

  const icons = {
    new: <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />,
    viewed: <Eye className="w-3 h-3" />,
    applied: <CheckCircle className="w-3 h-3" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function NotificationItem({
  notification,
  onStatusChange,
}: NotificationItemProps) {
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleStatusChange = async (newStatus: Notification["status"]) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id, status: newStatus }),
      });
      if (res.ok) {
        onStatusChange(notification.id, newStatus);
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm p-5 transition-all ${
        notification.status === "new"
          ? "border-l-4 border-l-[#FF3E6C] border-gray-100"
          : "border-gray-100"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
            <Briefcase className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {notification.job_title}
              </h3>
              <MatchScoreBadge score={notification.match_score} size="sm" />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{notification.company}</p>
            <p className="text-xs text-gray-400 mt-1">
              {formatDate(notification.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={notification.status} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
        {/* Status updater */}
        <div className="flex gap-1.5">
          {STATUS_OPTIONS.filter((o) => o.value !== notification.status).map(
            (opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                disabled={updatingStatus}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Mark as {opt.label}
              </button>
            )
          )}
        </div>

        {/* Apply link */}
        {notification.job_url && (
          <a
            href={notification.job_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#FF3E6C] hover:underline"
            onClick={() => {
              if (notification.status === "new") {
                handleStatusChange("viewed");
              }
            }}
          >
            View job
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
