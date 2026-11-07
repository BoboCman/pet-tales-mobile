import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Pet Tale AI - Learn how we collect, use, and protect your data.",
  alternates: {
    canonical: "https://www.pettaleai.com/privacy",
  },
  robots: {
    index: true,
    follow: false,
  },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-950 border-b">
        <div className="container max-w-4xl mx-auto py-6 px-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-4xl mx-auto py-12 px-4">
        <div className="bg-white dark:bg-gray-950 rounded-lg shadow-sm border p-8 md:p-12">
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Effective Date: November 7, 2026</p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            {/* Introduction */}
            <section>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                This Privacy Policy describes how Glendale AI, LLC ("Glendale AI," "Company," "we," "us," or "our")
                collects, uses, discloses, and protects your personal information when you use our Pet Tale AI
                application, website located at pettaleai.com, and related services (collectively, the "Service"). We
                are committed to protecting your privacy and handling your data transparently.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                By using our Service, you acknowledge that you have read and understood this Privacy Policy. If you do
                not agree with our policies and practices, please do not use the Service.
              </p>
            </section>

            {/* Section 1 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>

              <h3 className="text-lg font-medium mt-4 mb-2">1.1 Information You Provide Directly</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong>Account Information:</strong> When you create an account, we collect your email address and
                password (stored in encrypted form).
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
                <strong>Pet Profile Information:</strong> When you create a pet profile, we collect: pet name, pet
                photos, species/breed, age or birth date, and personality traits you describe. This information
                personalizes the AI-generated narration and captions.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
                <strong>Video Content:</strong> You upload video files containing your pets. These videos may include
                visual content of your pets, your home environment, family members, or other individuals who may appear
                in the background.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
                <strong>Voice and Vibe Selections:</strong> Your preferences for AI voice styles and storytelling vibes
                that determine how your Pet Tale is narrated.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
                <strong>Communications:</strong> Any messages, feedback, or support requests you send us.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">1.2 Information Collected Automatically</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong>Device and Browser Information:</strong> Device type, operating system, browser type, screen
                resolution, and unique device identifiers.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
                <strong>Usage Data:</strong> Pages and features accessed, actions taken, time spent on the Service, Pet
                Tales created and shared, and referral sources.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
                <strong>Log Data:</strong> IP address, access times and dates, referring URLs, and error logs.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
                <strong>Cookies and Similar Technologies:</strong> We use cookies and local storage to maintain your
                session, remember your preferences, and analyze Service usage. See Section 9 for details.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">1.3 Information from Third Parties</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong>Payment Processor:</strong> Payments are processed by Stripe. When you subscribe or make a
                purchase, Stripe provides us with limited information including a customer ID, your plan and
                subscription status, renewal dates, transaction ID, amount paid, date and time, refunds or disputes,
                and partial payment method details. We do not receive or store your complete card number. Stripe
                handles your payment details under its own privacy policy.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">1.4 Information About Third Parties in Your Videos</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Your uploaded videos may contain images, likenesses, or voices of other individuals. We process this
                content as part of the video.{" "}
                <strong>
                  We do not and cannot verify that you have obtained consent from individuals appearing in your videos.
                </strong>{" "}
                You are responsible for obtaining appropriate consent as described in our{" "}
                <Link href="/terms" className="text-teal-600 hover:underline">
                  Terms of Service
                </Link>
                .
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>

              <h3 className="text-lg font-medium mt-4 mb-2">2.1 Providing and Operating the Service</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                <li>Creating and managing your account</li>
                <li>Processing your video uploads through our AI systems</li>
                <li>Generating AI voice narration based on your pet's profile and selected preferences</li>
                <li>Creating synchronized captions</li>
                <li>Hosting and delivering your Pet Tales</li>
                <li>Enabling sharing functionality and generating permanent shareable links</li>
                <li>Processing payments and managing your credit balance</li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">2.2 Improving and Developing the Service</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                <li>Analyzing usage patterns to improve features and user experience</li>
                <li>Developing new features and services</li>
                <li>Conducting internal research and analysis</li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">2.3 Communications</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                <li>Sending transactional emails (account verification, password resets, purchase confirmations)</li>
                <li>Notifying you when your Pet Tale is ready</li>
                <li>Responding to your inquiries and support requests</li>
                <li>Sending marketing communications (with your consent, where required)</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                We send email through an email delivery provider (Postmark). Our emails may contain tracking pixels
                and tracked links so we can see whether an email was delivered, opened or clicked, and stop sending
                to addresses that bounce or report spam. You can unsubscribe from marketing emails at any time using
                the link in each email or by contacting us.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">2.4 Safety, Security, and Content Moderation</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                <li>Detecting, preventing, and addressing fraud, abuse, or security issues</li>
                <li>Enforcing our Terms of Service</li>
                <li>Reviewing and moderating content</li>
                <li>Complying with legal obligations</li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">2.5 Human Review of Content</h3>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  <strong>
                    Your content may be reviewed by our team for quality assurance, safety, content moderation, or legal
                    compliance purposes.
                  </strong>{" "}
                  Such review may occur before, during, or after content is made available through the Service. Human
                  reviewers are subject to confidentiality obligations. We do not use human review to build profiles or
                  make automated decisions about individuals appearing in your content.
                </p>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Third-Party Service Providers and AI Processing</h2>

              <h3 className="text-lg font-medium mt-4 mb-2">3.1 Categories of Service Providers</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We use third-party service providers to operate the Service. These providers fall into the following
                categories:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                <li>
                  <strong>AI Processing Providers:</strong> Third-party artificial intelligence services that process
                  your videos to generate transcriptions, analyze content, and create voice narration.
                </li>
                <li>
                  <strong>Cloud Infrastructure Providers:</strong> Services that host our databases, store your videos
                  and Pet Tales, and deliver content.
                </li>
                <li>
                  <strong>Payment Processors:</strong> Services that securely process your payment transactions.
                </li>
                <li>
                  <strong>Analytics Providers:</strong> Services that help us understand how users interact with the
                  Service.
                </li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">3.2 AI Provider Data Practices</h3>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  <strong>IMPORTANT DISCLOSURE:</strong> When you upload videos to our Service, portions of your content
                  (including video frames, audio, and derived text) are transmitted to third-party AI service providers
                  for processing. These providers may retain and use data processed through their systems for their own
                  purposes, including to improve and train their AI models, subject to their own privacy policies and
                  terms of service. While we select providers with strong privacy practices, we do not control the data
                  practices of these third parties.
                </p>
              </div>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                By using the Service, you acknowledge and consent to this processing by third-party AI providers. If you
                do not consent to such processing, you should not use the Service.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">3.3 AI Voice Generation</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                AI-generated voices are created by third-party voice synthesis providers. These voices are entirely
                synthetic. Any resemblance to real individuals is unintentional and coincidental. We do not use
                recordings of real individuals' voices to create custom voice clones for Pet Tales.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">3.4 Data Sharing with Service Providers</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We share information with service providers only as necessary for them to perform their services. Our
                infrastructure and storage providers are contractually obligated to use your information only as
                directed by us. However, AI processing providers operate under their own terms, which may include rights
                to use processed data as described above.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">4. No Facial Recognition or Biometric Processing</h2>
              <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  <strong>
                    Pet Tale AI does not use facial recognition technology. We do not create biometric identifiers or
                    templates. We do not identify individuals through voice pattern analysis or any biometric means.
                  </strong>
                </p>
              </div>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                While our AI analyzes video content to generate narration and captions, this analysis is focused on the
                visual scene, pet activity, and general content of the video—not on identifying, profiling, or tracking
                individuals who may appear. AI voice generation uses synthetic voices that are not derived from or
                matched to real individuals.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                We do not: create facial geometry maps or templates; store voiceprints or voice signatures; use
                biometric data for identification or authentication; compare individuals against databases; or create
                persistent identifiers based on physical characteristics.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">5. No Automated Decision-Making About Individuals</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong>
                  Pet Tale AI does not use automated decision-making to evaluate, profile, score, or make determinations
                  about individuals.
                </strong>{" "}
                AI processing is used solely to generate creative entertainment content based on your pet profile and
                video. No decisions affecting individuals' rights, opportunities, access to services, or legal status
                are made by our AI systems.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                The AI-generated narration and captions are creative content for entertainment purposes only and do not
                represent assessments, evaluations, or judgments about any person appearing in the videos.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">6. How We Share Your Information</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We do not sell your personal information. We share your information only in the following circumstances:
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">6.1 Service Providers</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                As described in Section 3, we share information with third-party service providers who perform services
                on our behalf.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">6.2 Community and Public Sharing</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If you choose to share your Pet Tales publicly through our Community Spotlight feature or via shareable
                links, your Pet Tale content will be visible to anyone with access to the community page or link.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">6.3 Shareable Links</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                When you create a shareable link for your Pet Tale, anyone with that link can view the content.
                Shareable links are permanent and will continue to function even after account deletion, subject to our
                content removal rights. We do not control how recipients may further share content accessed through
                shareable links.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">6.4 Legal Requirements</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We may disclose your information if required to do so by law or in response to valid requests by public
                authorities (such as a court order, subpoena, or government request).
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">6.5 Business Transfers</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If Glendale AI is involved in a merger, acquisition, or asset sale, your information may be transferred
                as part of that transaction. We will provide notice before your personal information becomes subject to
                a different privacy policy.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">6.6 Protection of Rights</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We may disclose information when we believe in good faith that disclosure is necessary to protect our
                rights, protect your safety or the safety of others, investigate fraud, or respond to a legal request.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>

              <h3 className="text-lg font-medium mt-4 mb-2">7.1 Retention Periods</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong>Account Information:</strong> Retained while your account is active and for a reasonable period
                thereafter for legal and business purposes.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
                <strong>Original Uploaded Videos:</strong> After your Pet Tale is generated, original uploaded video
                files may be deleted from our processing systems within 30 days. We do not retain original video files
                indefinitely.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
                <strong>Processed Pet Tales:</strong> Your completed Pet Tales (the merged videos with AI narration and
                captions) are retained indefinitely to maintain shareable links, unless you request deletion or we
                remove content pursuant to our content removal rights (DMCA, court orders, privacy requests, or at our
                discretion).
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
                <strong>Pet Profiles:</strong> Retained while your account is active. Deleted upon account deletion.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
                <strong>Transaction Records:</strong> Retained for seven (7) years for tax and accounting purposes.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">7.2 Account Deletion</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                You may request account deletion by contacting pettaleai@gmail.com. Upon account deletion: Your account,
                profile, and pet information will be permanently deleted. However, shared Pet Tales accessible via
                shareable links will remain available indefinitely unless you specifically request removal of individual
                Pet Tales, as these are licensed content under our Terms of Service.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">7.3 Third-Party Retention</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Data shared with third-party AI service providers may be retained by those providers according to their
                own data retention policies, even after you delete your account with us.
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Your Rights and Choices</h2>

              <h3 className="text-lg font-medium mt-4 mb-2">8.1 Access and Portability</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                You may request a copy of your personal information by using the "Request My Data" feature in your
                account settings or by contacting us at pettaleai@gmail.com. We will provide your data within 30 days.
                Exportable data includes: account and pet profiles, tale content and video links, and purchase history.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">8.2 Correction</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                You may update or correct your account information and pet profiles at any time through the Service.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">8.3 Deletion</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                You may request account deletion by contacting pettaleai@gmail.com. Please note the limitations on
                deletion described in Section 7.2 regarding retention of Pet Tales.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">8.4 Content Removal Requests (Third Parties)</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If you appear in a Pet Tale created by another user and did not consent to your appearance, you may
                submit a removal request to pettaleai@gmail.com. We will review such requests and may remove the content
                at our discretion.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">8.5 Parental Rights and Minor Removal Requests</h3>
              <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  <strong>
                    Parents or legal guardians may request removal of content containing their minor children by
                    contacting pettaleai@gmail.com.
                  </strong>{" "}
                  Such requests should include: (a) identification or description of the content; (b) your relationship
                  to the minor (parent or legal guardian); and (c) contact information for verification purposes. We
                  will review parental removal requests and may remove content at our discretion, giving appropriate
                  weight to the safety and privacy interests of minors.
                </p>
              </div>

              <h3 className="text-lg font-medium mt-4 mb-2">8.6 Marketing Communications</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                You may opt out of marketing emails by clicking the "unsubscribe" link in any marketing email. You will
                still receive transactional communications.
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Cookies and Tracking Technologies</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We use the following types of cookies:
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong>Essential Cookies:</strong> Required for the Service to function, including authentication and
                session management. These cannot be disabled.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
                <strong>Functional Cookies:</strong> Remember your preferences such as language and voice selections.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
                <strong>Analytics Cookies:</strong> Help us understand how visitors use the Service. This data is
                aggregated.
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Children's Privacy</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                The Service is not directed to children under the age of 13. We do not knowingly collect personal
                information from children under 13. If you are a parent or guardian and believe your child has created
                an account or provided us with personal information, please contact us at pettaleai@gmail.com. If we
                become aware that we have collected personal information from a child under 13, we will delete such
                information promptly.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                <strong>Minors in Videos:</strong> Videos uploaded by adult users may contain images of minors (such as
                children playing with pets). The adult user uploading such content is responsible for having appropriate
                parental consent as described in our Terms of Service. We do not verify that such consent has been
                obtained. Parents or legal guardians may request removal of content containing their minor children as
                described in Section 8.5.
              </p>
            </section>

            {/* Section 11 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Data Security</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal information,
                including encryption of data in transit using TLS/SSL, secure cloud infrastructure, access controls, and
                regular security assessments. However, no method of transmission over the Internet is 100% secure, and
                we cannot guarantee absolute security.
              </p>
            </section>

            {/* Section 12 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">12. International Data Transfers</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Glendale AI is based in the United States. Your information may be transferred to, stored, and processed
                in the United States and other countries where our service providers operate. These countries may have
                data protection laws that differ from your country. By using the Service, you consent to the transfer of
                your information to the United States and other jurisdictions.
              </p>
            </section>

            {/* Section 13 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">13. California Privacy Rights (CCPA/CPRA)</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                If you are a California resident, you have additional rights under the California Consumer Privacy Act
                (CCPA) as amended by the California Privacy Rights Act (CPRA):
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                <li>
                  <strong>Right to Know:</strong> Request information about personal information we have collected.
                </li>
                <li>
                  <strong>Right to Delete:</strong> Request deletion of your personal information, subject to exceptions
                  (including our right to retain Pet Tales as licensed content under our Terms of Service).
                </li>
                <li>
                  <strong>Right to Correct:</strong> Request correction of inaccurate personal information.
                </li>
                <li>
                  <strong>Right to Opt-Out of Sale/Sharing:</strong> We do not sell personal information or share it for
                  cross-context behavioral advertising.
                </li>
                <li>
                  <strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your
                  privacy rights.
                </li>
              </ul>

              <h3 className="text-lg font-medium mt-6 mb-4">Categories of Personal Information Collected</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300 dark:border-gray-700">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left font-semibold">
                        Category
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left font-semibold">
                        Examples
                      </th>
                      <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left font-semibold">
                        Purpose
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Identifiers</td>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                        Email, IP address, device ID
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                        Account creation, security
                      </td>
                    </tr>
                    <tr className="bg-gray-50 dark:bg-gray-900">
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Commercial Info</td>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                        Purchase history, credits
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Transaction processing</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Internet Activity</td>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                        Usage data, browsing history
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Service improvement</td>
                    </tr>
                    <tr className="bg-gray-50 dark:bg-gray-900">
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Audio/Visual</td>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Videos, pet photos</td>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                        Core service functionality
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Inferences</td>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Preferences, interests</td>
                      <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">Personalization</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 14 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">14. European Users (GDPR)</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, you have
                additional rights under the General Data Protection Regulation (GDPR):
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">14.1 Legal Basis for Processing</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                <li>
                  <strong>Contract:</strong> Processing necessary to provide the Service you requested.
                </li>
                <li>
                  <strong>Legitimate Interests:</strong> Processing for our legitimate business interests, such as
                  improving the Service and content moderation.
                </li>
                <li>
                  <strong>Consent:</strong> Processing based on your explicit consent.
                </li>
                <li>
                  <strong>Legal Obligation:</strong> Processing necessary to comply with legal requirements.
                </li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">14.2 Your GDPR Rights</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                You have the right to: access your personal data; rectify inaccurate data; erase your data (subject to
                limitations, including our right to retain content under license and respond to legal requests);
                restrict processing; data portability; object to processing; and withdraw consent. You also have the
                right to lodge a complaint with your local data protection authority.
              </p>
            </section>

            {/* Section 15 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">15. Changes to This Privacy Policy</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of material changes by posting
                the new Privacy Policy and updating the "Effective Date." Your continued use of the Service after
                changes indicates acceptance of the updated Privacy Policy.
              </p>
            </section>

            {/* Section 16 */}
            <section className="bg-teal-50 dark:bg-teal-900/20 p-6 rounded-lg">
              <h2 className="text-2xl font-semibold mb-4">16. Contact Us</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="mt-4 space-y-2">
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Glendale AI, LLC</strong>
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Email:</strong>{" "}
                  <a href="mailto:pettaleai@gmail.com" className="text-teal-600 hover:underline">
                    pettaleai@gmail.com
                  </a>
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Website:</strong>{" "}
                  <a href="https://www.pettaleai.com" className="text-teal-600 hover:underline">
                    www.pettaleai.com
                  </a>
                </p>
              </div>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                <strong>Data Controller:</strong> For the purposes of applicable data protection laws, Glendale AI, LLC
                is the data controller of your personal information collected through the Service.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t">
            <Button asChild variant="outline" className="bg-transparent">
              <Link href="/auth/signup">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign Up
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
