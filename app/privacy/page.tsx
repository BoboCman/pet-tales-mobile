import Link from "next/link"
import type { Metadata } from "next"
import { LegalPage, LegalSection, ContactEmail } from "@/components/legal/legal-page"
import { LEGAL_VERSIONS } from "@/lib/constants/legal"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Pet Tale AI collects, uses and protects your information, in plain language.",
  alternates: {
    canonical: "https://www.pettaleai.com/privacy",
  },
  robots: {
    index: true,
    follow: false,
  },
}

/** Kinds of services that help us run Pet Tale (categories, as privacy laws require) */
const PROVIDERS: { name: string; does: string }[] = [
  { name: "Hosting and storage", does: "Keep your account and tales safe" },
  { name: "Processing and AI services", does: "Help create your tales" },
  { name: "Payments", does: "Handle checkout and billing" },
  { name: "Email", does: "Send our emails" },
  { name: "Analytics", does: "Count visits so we know what's working" },
  { name: "Advertising", does: "Show Pet Tale to people who'd enjoy it and tell us which ads work" },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effectiveDate={LEGAL_VERSIONS.EFFECTIVE_DATE}
      intro={
        <>
          <p>
            Your pet&apos;s moments are personal, and so is your information. This policy explains what we collect,
            why, and the choices you have. Pet Tale AI is run by Glendale AI, LLC, a New Jersey company (&ldquo;we&rdquo;
            or &ldquo;us&rdquo;), which is responsible for your information.
          </p>
        </>
      }
      nutshell={[
        "We collect only what we need to make your tales and run your account.",
        "We don't sell your information. We use ad partners to see which of our ads work, and you can turn that off anytime.",
        "Your clips go to a few trusted services that help make your tales. The kinds of services are listed below.",
        "Private tales stay private. Anyone can watch public tales and tales you share by link.",
        "You can see, fix or delete your information anytime. Just ask.",
      ]}
    >
      <LegalSection id="collect" title="1. What we collect">
        <p>
          <strong>What you give us:</strong>
        </p>
        <ul>
          <li>Your email, password (stored securely, and we never see it) and the name you choose to show.</li>
          <li>Your pet&apos;s details: name, type, photo, personality and quirks.</li>
          <li>
            The clips you upload. These may also show your home, your family or other people, and that comes along
            with the clip.
          </li>
          <li>Your picks, like voice and vibe, and anything you send us.</li>
        </ul>
        <p>
          <strong>What we collect automatically:</strong> your device and browser type, IP address, the pages and
          features you use, how you found us (for example, a shared tale or an ad link), and error logs. We use
          cookies and similar storage to keep you signed in and remember your settings, and, unless you opt out, ad
          cookies and pixels that tell our ad partners when you visit, sign up or buy.
        </p>
        <p>
          <strong>What others tell us:</strong> our payment processor tells us about your plan and payments (amounts,
          dates, card brand and last four digits, never your full card number). Our email provider tells us whether
          our emails were
          delivered, opened or clicked.
        </p>
      </LegalSection>

      <LegalSection id="use" title="2. How we use it">
        <ul>
          <li>To make your tales, and to run your account, plan and payments.</li>
          <li>
            To send emails you need, like &ldquo;your tale is ready,&rdquo; receipts and password resets. If you said
            yes at signup, we&apos;ll also send occasional news and offers. Unsubscribe anytime from any email.
          </li>
          <li>
            To keep Pet Tale safe: preventing fraud and abuse, and reviewing content. Our team may look at tales to do
            this.
          </li>
          <li>To fix problems and make Pet Tale better.</li>
          <li>
            To measure our ads and show Pet Tale to people who might enjoy it. You can turn this off on{" "}
            <Link href="/privacy/choices">Your privacy choices</Link>.
          </li>
          <li>To follow the law.</li>
        </ul>
      </LegalSection>

      <LegalSection id="share" title="3. Who helps us, and who sees what">
        <p>
          <strong>We don&apos;t sell your information.</strong> We share it only with the kinds of services that
          help us run Pet Tale:
        </p>
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <tbody>
              {PROVIDERS.map((p) => (
                <tr key={p.name} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                  <th scope="row" className="w-2/5 px-3 py-2 align-top font-semibold text-gray-900 dark:text-white">
                    {p.name}
                  </th>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{p.does}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          These services get only what they need to create your tale. Each handles data under its own terms, and
          some may keep it for a while or use it to improve their services.
        </p>
        <p>
          <strong>Ads.</strong> To see which ads bring people to Pet Tale, our advertising partners get limited
          information: the pages you visit, when you sign up or buy (and the amount), your device and IP address,
          and a scrambled (hashed) version of your email. They never get your clips, tales or pet details. Privacy
          laws may call this &ldquo;sharing&rdquo; or &ldquo;targeted advertising.&rdquo; You can turn it off
          anytime on <Link href="/privacy/choices">Your privacy choices</Link>, and we treat a Global Privacy Control
          signal from your browser as a request to opt out.
        </p>
        <p>
          <strong>Your tales.</strong> Tales are private until you share them. Anyone with a share link can watch
          that tale, and public tales appear in our Community for everyone. We may feature public tales in our own
          unpaid social media posts, and we&apos;ll ask you first before using one in paid ads. Once something is
          shared, we can&apos;t control where others pass it on.
        </p>
        <p>
          <strong>Other times.</strong> We may share information when the law requires it, to protect someone&apos;s
          safety or our rights, or as part of a merger or sale of the business. If that happens, we&apos;ll let you
          know before your information falls under a different policy.
        </p>
      </LegalSection>

      <LegalSection id="faces" title="4. No face recognition">
        <p>
          We don&apos;t use facial recognition, we don&apos;t create biometric data like face or voice prints, and
          we don&apos;t identify or profile the people in your clips.
        </p>
      </LegalSection>

      <LegalSection id="keep" title="5. How long we keep it">
        <ul>
          <li>Your account, pets, clips and tales: for as long as your account is open.</li>
          <li>
            When you delete your account, we delete your login, profile, pet details, private tales and the clips
            behind them. Public tales stay up unless you make them private first or ask us to remove them.
          </li>
          <li>Payment records: as long as tax and accounting laws require, usually seven years.</li>
          <li>Backups and logs may keep copies for a short time before they&apos;re cleared.</li>
        </ul>
      </LegalSection>

      <LegalSection id="rights" title="6. Your choices and rights">
        <p>Wherever you live, you can:</p>
        <ul>
          <li>Get a copy of your information.</li>
          <li>Correct it. Most of it you can edit yourself in Settings.</li>
          <li>Delete it. Use Delete account in Settings, or ask us.</li>
          <li>Stop marketing emails with the unsubscribe link in any email.</li>
          <li>
            Opt out of ad tracking (&ldquo;sharing&rdquo; for ads) on{" "}
            <Link href="/privacy/choices">Your privacy choices</Link>.
          </li>
          <li>Ask us to remove a tale you appear in, or one that shows your child.</li>
        </ul>
        <p>
          Email <ContactEmail /> and we&apos;ll respond within 30 days. We may need to confirm it&apos;s really you.
          Using your rights will never cost you anything or change how we treat you.
        </p>
        <p>
          Some places, such as California, New Jersey and other US states, the EU and the UK, give you these rights by
          law. The categories of information we collect are listed in section 1: identifiers (like email and IP
          address), purchase history, app activity, audio and video (your clips and photos), and your preferences. If
          you&apos;re in the EU or UK, we use your information to provide the service you asked for, for our
          legitimate interests in keeping Pet Tale safe and improving it, with your consent for marketing, and to meet
          legal duties. You can also complain to your local data protection authority.
        </p>
      </LegalSection>

      <LegalSection id="kids" title="7. Kids">
        <p>
          Pet Tale is for adults, and accounts are for people 18 and over. We don&apos;t knowingly collect information
          from children under 13. If you think a child has given us information, email us and we&apos;ll delete it.
          Kids often star alongside their pets: if a child appears in a clip, the adult uploading it needs to be their
          parent or guardian, or have their permission. Parents can ask us to remove any tale showing their child.
        </p>
      </LegalSection>

      <LegalSection id="security" title="8. Keeping it safe">
        <p>
          We protect your information with encryption in transit, secure cloud services and limited access. No system
          is perfect, but if a breach ever affects your information, we&apos;ll tell you as the law requires.
        </p>
        <p>
          We&apos;re based in the United States, so your information is stored and processed in the US and wherever
          our providers operate.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="9. Changes">
        <p>
          If we update this policy, we&apos;ll post it here and change the date at the top. For big changes, we&apos;ll
          also email you or show a notice in the app first. See our <Link href="/terms">Terms of Service</Link> for the
          rest of how Pet Tale works.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="10. Contact us">
        <p>
          Questions about your privacy? Email <ContactEmail />.
        </p>
        <p>Glendale AI, LLC · New Jersey, USA · pettaleai.com</p>
      </LegalSection>
    </LegalPage>
  )
}
