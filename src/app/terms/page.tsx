import Link from "next/link";
import { Briefcase } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — JobMate",
};

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mt-6 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400">Last updated: May 2, 2026</p>
      </div>

      <div className="space-y-10 text-gray-700 leading-relaxed">

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Agreement</h2>
          <p>
            By using JobMate, you agree to these terms. If you don&apos;t agree, please don&apos;t
            use the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">What JobMate does</h2>
          <p>
            JobMate uses AI to match your resume against live job listings. We show you a match
            score and let you click through to the employer&apos;s application page. We don&apos;t
            apply on your behalf, and we don&apos;t guarantee interviews, offers, or employment
            outcomes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Your account</h2>
          <p>
            You&apos;re responsible for keeping your password safe. You must be at least 16 years
            old to create an account. You agree to provide accurate information about yourself.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Acceptable use</h2>
          <p className="mb-4">You agree not to:</p>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li>Upload anyone else&apos;s resume without their permission</li>
            <li>Upload content that is illegal, harmful, or violates third-party rights</li>
            <li>Try to break, scrape, or overload our service</li>
            <li>Use JobMate to spam employers or applicants</li>
            <li>Reverse engineer our AI matching system</li>
          </ul>
          <p className="mt-4">We can suspend or terminate accounts that violate these rules.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Job listings</h2>
          <p>
            Job listings come from third-party sources (primarily Adzuna). We don&apos;t control
            which jobs are listed, whether they&apos;re still open, or how employers respond to
            applications. We&apos;re not responsible for any interactions between you and employers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">AI matching</h2>
          <p>
            Our match scores are AI-generated estimates, not guarantees. A high match doesn&apos;t
            guarantee a job offer, and a low match doesn&apos;t mean you shouldn&apos;t apply. Use
            your own judgment.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Our liability</h2>
          <p>
            JobMate is provided as-is. We do our best to keep the service running, but we
            don&apos;t guarantee uptime, accuracy, or specific outcomes. To the extent allowed by
            law, we&apos;re not liable for indirect damages, lost opportunities, or lost income.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Changes</h2>
          <p>
            We may update these terms over time. If we make significant changes, we&apos;ll let you
            know via email or a notice in the app. Continued use after changes means you accept the
            new terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact</h2>
          <p>
            Questions? Email us at{" "}
            <a
              href="mailto:hello@jobmate.app"
              className="text-[#FF3E6C] hover:underline"
            >
              hello@jobmate.app
            </a>
            .
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
