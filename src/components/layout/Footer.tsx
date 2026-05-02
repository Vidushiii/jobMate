import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-100 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
        <span>© 2026 JobMate</span>
        <div className="flex items-center gap-5">
          <Link href="/privacy" className="hover:text-gray-600 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-gray-600 transition-colors">
            Terms
          </Link>
          <a
            href="mailto:hello@jobmate.app"
            className="hover:text-gray-600 transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}
