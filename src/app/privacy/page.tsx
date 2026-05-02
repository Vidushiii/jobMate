import Link from "next/link";
import { Briefcase } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — JobMate",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-[720px] mx-auto px-6 py-12">
      <div className="mb-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#FF3E6C] font-bold text-lg mb-8"
        >
          <Briefcase className="w-5 h-5" />
          JobMate
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-6 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400">Last updated: May 2, 2026</p>
      </div>

      <div className="prose-jobmate space-y-10 text-gray-700 leading-relaxed">

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Who we are</h2>
          <p>
            JobMate is an AI-powered job search platform that matches your resume to relevant job
            openings. This policy explains what data we collect, how we use it, and your rights
            over it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">What we collect</h2>
          <p className="mb-4 font-medium text-gray-800">When you use JobMate without an account:</p>
          <ul className="list-disc list-outside ml-5 space-y-2 mb-6">
            <li>Resume content you upload (text extracted from your PDF or DOCX)</li>
            <li>A temporary session identifier stored in a secure cookie</li>
            <li>
              Anonymous usage events (jobs viewed, apply clicks, match scores) if you opt in
            </li>
          </ul>
          <p className="mb-4 font-medium text-gray-800">
            When you create an account, we additionally collect:
          </p>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li>
              Your email address and password (password is encrypted, we never see it in plain
              text)
            </li>
            <li>Optional profile details: name, location, LinkedIn URL</li>
            <li>Your saved resume and job preferences</li>
            <li>Notification preferences</li>
            <li>A history of job alerts we&apos;ve sent you</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">How we use your data</h2>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li>To extract skills from your resume using Google Gemini AI</li>
            <li>To match your skills to live job listings from Adzuna</li>
            <li>To send you job alert emails (only if you&apos;ve opted in)</li>
            <li>
              To improve our matching accuracy through aggregated, anonymized usage analysis
            </li>
          </ul>
          <p className="mt-4">
            We do not sell your data. We do not share your resume content with employers,
            recruiters, or third parties for marketing.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Third parties we work with</h2>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li>
              <span className="font-medium">Google Gemini</span> — processes your resume text to
              extract skills
            </li>
            <li>
              <span className="font-medium">Adzuna</span> — provides live job listings (we send
              your skills, not your resume)
            </li>
            <li>
              <span className="font-medium">Supabase</span> — stores your account data securely
            </li>
            <li>
              <span className="font-medium">Resend</span> — sends notification emails
            </li>
            <li>
              <span className="font-medium">Sentry</span> — captures error reports (no resume
              content)
            </li>
          </ul>
          <p className="mt-4">
            Each of these providers has their own privacy policy. We send only what&apos;s necessary
            for the service to function.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">How long we keep it</h2>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li>
              <span className="font-medium">Anonymous sessions:</span> your resume data exists
              only during your active session and is discarded when you close the browser
            </li>
            <li>
              <span className="font-medium">Account data:</span> kept for as long as your account
              is active
            </li>
            <li>
              <span className="font-medium">Deleted accounts:</span> all your data is permanently
              removed within 24 hours of you requesting deletion
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Your rights</h2>
          <p className="mb-4">You can at any time:</p>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li>Download a copy of your data (email us)</li>
            <li>
              Delete your account and all associated data (from your profile page or by emailing
              us)
            </li>
            <li>Opt out of analytics tracking</li>
            <li>Unsubscribe from notification emails</li>
          </ul>
          <p className="mt-4">
            If you&apos;re in the EU, UK, or California, you have additional rights under GDPR and
            CCPA — including the right to access, correct, port, and erase your data, and to
            object to processing.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Cookies</h2>
          <p className="mb-4">We use a small number of cookies:</p>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li>
              <span className="font-medium">Session cookie</span> — keeps you logged in
            </li>
            <li>
              <span className="font-medium">Consent cookie</span> — remembers that you accepted
              resume processing
            </li>
            <li>
              <span className="font-medium">Analytics cookie</span> — only set if you opt in to
              usage tracking
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact</h2>
          <p>
            Questions or requests? Email us at{" "}
            <a
              href="mailto:hello@jobmate.app"
              className="text-[#FF3E6C] hover:underline"
            >
              hello@jobmate.app
            </a>
            . We respond within 5 business days.
          </p>
        </section>

      </div>

      <div className="mt-12 pt-8 border-t border-gray-100">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#FF3E6C] hover:underline"
        >
          ← Back to JobMate
        </Link>
      </div>
    </div>
  );
}
