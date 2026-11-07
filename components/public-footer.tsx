import Link from "next/link"

export function PublicFooter() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Copyright - Left on desktop, top on mobile */}
          <div className="text-sm text-muted-foreground">© {new Date().getFullYear()} Glendale AI, LLC</div>

          {/* Links - Right on desktop, bottom on mobile */}
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <a
              href="mailto:pettaleai@gmail.com"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
