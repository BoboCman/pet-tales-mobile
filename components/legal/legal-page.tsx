import Link from "next/link"
import { ArrowLeft, PawPrint } from "lucide-react"

/**
 * Shared layout for the Terms and Privacy pages: a friendly intro, a short "in a nutshell"
 * summary, then plain-language sections. Server component, no client JS.
 */
export function LegalPage({
  title,
  effectiveDate,
  intro,
  nutshell,
  children,
}: {
  title: string
  effectiveDate: string
  intro: React.ReactNode
  nutshell: React.ReactNode[]
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-gray-900 md:pb-0">
      <div className="border-b bg-white dark:bg-gray-950">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">Effective {effectiveDate}</p>

        <div className="mt-5 space-y-3 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300 [&_a]:font-medium [&_a]:text-teal-700 [&_a]:underline [&_a]:underline-offset-2">{intro}</div>

        <section aria-labelledby="nutshell" className="mt-6 rounded-2xl bg-teal-50 p-5 dark:bg-teal-900/20">
          <h2 id="nutshell" className="flex items-center gap-2 text-base font-semibold text-teal-900 dark:text-teal-100">
            <PawPrint className="h-4 w-4" />
            In a nutshell
          </h2>
          <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-teal-950 dark:text-teal-50">
            {nutshell.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-8 space-y-8">{children}</div>
      </article>
    </div>
  )
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <h2 id={`${id}-title`} className="text-xl font-semibold text-gray-900 dark:text-white">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300 [&_a]:font-medium [&_a]:text-teal-700 [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  )
}

export const CONTACT_EMAIL = "pettaleai@gmail.com"

export function ContactEmail() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
}
