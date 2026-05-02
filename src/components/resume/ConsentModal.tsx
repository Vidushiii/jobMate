"use client";

import { Shield, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export function ConsentModal({ isOpen, onAccept, onCancel }: ConsentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#FFF0F3] rounded-full flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-[#FF3E6C]" />
          </div>
          <h2 id="consent-title" className="text-lg font-semibold text-gray-900">
            Before we continue
          </h2>
        </div>

        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
          Your resume will be processed by our AI to find matching jobs. Here&apos;s
          what that means for your data:
        </p>

        <div className="space-y-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <Shield className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">AI processing only</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Your resume is parsed to extract skills and match you with jobs.
                No human reviews your data.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <EyeOff className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">Not stored on your device</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Your resume is processed on our servers to generate matches, then
                discarded after this session. Nothing is saved to your browser or
                without your permission.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
              <Trash2 className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">No account required</p>
              <p className="text-sm text-gray-500 mt-0.5">
                You can search jobs without creating an account. Create one
                only if you want to save results or get email alerts.
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-6">
          By continuing, you agree to our{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FF3E6C] hover:underline"
          >
            Privacy Policy
          </a>{" "}
          and{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#FF3E6C] hover:underline"
          >
            Terms
          </a>
          .
        </p>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={onAccept}
            className="flex-1"
          >
            Continue & Upload
          </Button>
        </div>
      </div>
    </div>
  );
}
