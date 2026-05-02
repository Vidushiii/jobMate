"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import type { Notification } from "@/types";
import Link from "next/link";

type StatusFilter = "all" | Notification["status"];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setNotifications(data.notifications ?? []);
        }
      })
      .catch(() => setError("Failed to load notifications."))
      .finally(() => setLoading(false));
  }, []);

  const handleStatusChange = (id: string, status: Notification["status"]) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status } : n))
    );
  };

  const filtered =
    filter === "all"
      ? notifications
      : notifications.filter((n) => n.status === filter);

  const counts = {
    all: notifications.length,
    new: notifications.filter((n) => n.status === "new").length,
    viewed: notifications.filter((n) => n.status === "viewed").length,
    applied: notifications.filter((n) => n.status === "applied").length,
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job alerts</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Jobs matched to your profile by our nightly AI scan.
          </p>
        </div>
        {counts.new > 0 && (
          <span className="bg-[#FF3E6C] text-white text-sm font-semibold px-3 py-1 rounded-full">
            {counts.new} new
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-gray-50 p-1 rounded-xl w-fit">
        {(["all", "new", "viewed", "applied"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
            {counts[tab] > 0 && (
              <span className="ml-1.5 text-xs text-gray-400">
                ({counts[tab]})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <div className="py-12 text-center">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && notifications.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BellOff className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No job alerts yet
          </h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
            Enable email notifications on your profile and we&apos;ll send you
            matching jobs every day.
          </p>
          <Link href="/profile">
            <Button>
              <Bell className="w-4 h-4" />
              Enable alerts
            </Button>
          </Link>
        </div>
      )}

      {!loading && !error && notifications.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">
            No {filter} notifications.{" "}
            <button
              onClick={() => setFilter("all")}
              className="text-[#FF3E6C] hover:underline"
            >
              View all
            </button>
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
