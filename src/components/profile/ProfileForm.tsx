"use client";

import { useState } from "react";
import { Upload, FileText, Bell, BellOff, ExternalLink, Trash2, CheckCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Toast, useToast } from "@/components/ui/Toast";
import { ResumeDropzone } from "@/components/resume/ResumeDropzone";
import type { UserProfile } from "@/types";

interface ProfileFormProps {
  initialData: UserProfile;
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [profile, setProfile] = useState<UserProfile>(initialData);
  const [saving, setSaving] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [removingResume, setRemovingResume] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast, show: showToast, hide: hideToast } = useToast();
  const supabase = createClient();
  const router = useRouter();

  // Parse filename and upload date stored as "filename|isoDate" in resume_url
  const resumeInfo = (() => {
    if (!profile.resume_url) return null;
    const [filename, isoDate] = profile.resume_url.split("|");
    return {
      filename: filename ?? "resume",
      uploadedAt: isoDate ? new Date(isoDate) : null,
    };
  })();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        location: profile.location,
        linkedin_url: profile.linkedin_url,
        notification_enabled: profile.notification_enabled,
        notification_frequency: profile.notification_frequency,
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Profile saved successfully.", "success");
    }
  };

  const handleResumeUpload = async () => {
    if (!resumeFile) return;
    setUploadingResume(true);

    try {
      const formData = new FormData();
      formData.append("resume", resumeFile);
      formData.append("consent_token", "user_consented");

      const parseRes = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });

      if (!parseRes.ok) {
        const { error } = await parseRes.json();
        throw new Error(error);
      }

      const parsed = await parseRes.json();

      const saveRes = await fetch("/api/save-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: parsed, filename: resumeFile.name }),
      });

      if (!saveRes.ok) {
        const { error } = await saveRes.json();
        throw new Error(error ?? "Failed to save resume.");
      }

      // Refetch the updated profile row so the saved card reflects the new data
      const { data: updated } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profile.id)
        .single();

      if (updated) {
        setProfile((p) => ({ ...p, ...updated }));
      }

      setResumeFile(null);
      setShowReplace(false);
      showToast("Resume updated and processed successfully.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to upload resume.",
        "error"
      );
    } finally {
      setUploadingResume(false);
    }
  };

  const handleRemoveResume = async () => {
    setRemovingResume(true);
    const { error } = await supabase
      .from("profiles")
      .update({ resume_url: null, resume_text: null })
      .eq("id", profile.id);
    setRemovingResume(false);

    if (error) {
      showToast(error.message, "error");
      return;
    }

    setProfile((p) => ({ ...p, resume_url: undefined, resume_text: undefined }));
    showToast("Resume removed.", "success");
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/delete-account", { method: "DELETE" });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error);
      }
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      setDeleting(false);
      setShowDeleteModal(false);
      showToast(
        err instanceof Error ? err.message : "Failed to delete account.",
        "error"
      );
    }
  };

  const set = (field: keyof UserProfile, value: string | boolean) =>
    setProfile((p) => ({ ...p, [field]: value }));

  return (
    <>
      <form onSubmit={handleSave} className="space-y-8">
        {/* Personal info */}
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Personal information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Full name
              </label>
              <input
                type="text"
                value={profile.full_name ?? ""}
                onChange={(e) => set("full_name", e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3E6C] focus:border-transparent"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full px-3 py-2.5 border border-gray-100 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Location
              </label>
              <input
                type="text"
                value={profile.location ?? ""}
                onChange={(e) => set("location", e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3E6C] focus:border-transparent"
                placeholder="New York, NY"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                LinkedIn URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={profile.linkedin_url ?? ""}
                  onChange={(e) => set("linkedin_url", e.target.value)}
                  className="w-full px-3 py-2.5 pr-9 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF3E6C] focus:border-transparent"
                  placeholder="https://linkedin.com/in/..."
                />
                {profile.linkedin_url && (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Job alerts
          </h2>
          <div className="bg-gray-50 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {profile.notification_enabled ? (
                  <Bell className="w-5 h-5 text-[#FF3E6C]" />
                ) : (
                  <BellOff className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Email notifications
                  </p>
                  <p className="text-xs text-gray-500">
                    Get matched jobs sent to your inbox
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  set("notification_enabled", !profile.notification_enabled)
                }
                className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF3E6C] focus:ring-offset-2 ${
                  profile.notification_enabled ? "bg-[#FF3E6C]" : "bg-gray-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    profile.notification_enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {profile.notification_enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frequency
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(
                    [
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "instant", label: "Instant" },
                    ] as const
                  ).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set("notification_frequency", value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        profile.notification_frequency === value
                          ? "bg-[#FF3E6C] text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <Button type="submit" loading={saving} size="lg">
          Save changes
        </Button>
      </form>

      {/* Resume section — separate from form */}
      <div className="mt-10 pt-10 border-t border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Resume</h2>

        {/* Saved resume card */}
        {resumeInfo && !showReplace && (
          <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-4 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {resumeInfo.filename}
              </p>
              {resumeInfo.uploadedAt && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Uploaded{" "}
                  {resumeInfo.uploadedAt.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  · Last processed{" "}
                  {resumeInfo.uploadedAt.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3">
                <button
                  type="button"
                  onClick={() => setShowReplace(true)}
                  className="text-sm font-medium text-[#FF3E6C] hover:underline"
                >
                  Replace resume
                </button>
                <button
                  type="button"
                  onClick={handleRemoveResume}
                  disabled={removingResume}
                  className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  {removingResume ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state text when no resume */}
        {!resumeInfo && !showReplace && (
          <p className="text-sm text-gray-500 mb-4">
            No resume uploaded yet. Upload one to enable job matching.
          </p>
        )}

        {/* Dropzone: shown when no saved resume OR replacing */}
        {(!resumeInfo || showReplace) && (
          <div className="space-y-3">
            <ResumeDropzone
              onFileSelect={setResumeFile}
              selectedFile={resumeFile}
              onClear={() => setResumeFile(null)}
              disabled={uploadingResume}
            />
            <div className="flex items-center gap-3">
              {resumeFile && (
                <Button
                  onClick={handleResumeUpload}
                  loading={uploadingResume}
                  className="w-full sm:w-auto"
                >
                  <Upload className="w-4 h-4" />
                  Process resume
                </Button>
              )}
              {showReplace && (
                <button
                  type="button"
                  onClick={() => {
                    setShowReplace(false);
                    setResumeFile(null);
                  }}
                  className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="mt-16 pt-10 border-t border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Danger zone</h2>
        <p className="text-sm text-gray-500 mb-4">
          Permanently delete your account and all associated data.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete account
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setShowDeleteModal(false)}
          />
          <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-8"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-5">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Delete your account?
            </h2>
            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
              This will permanently delete your account and all your data. This cannot
              be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1"
              >
                Cancel
              </Button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hideToast} />
      )}
    </>
  );
}
