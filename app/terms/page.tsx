import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Pet Tale AI - AI-powered pet video narration service operated by Glendale AI, LLC.",
  alternates: {
    canonical: "https://www.pettaleai.com/terms",
  },
  robots: {
    index: true,
    follow: false,
  },
}

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Effective Date: November 8, 2026</p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            {/* Introduction */}
            <section>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Welcome to Pet Tale AI. These Terms of Service ("Terms") constitute a legally binding agreement between
                you ("User," "you," or "your") and Glendale AI, LLC, a New Jersey limited liability company ("Glendale
                AI," "Company," "we," "us," or "our"), governing your access to and use of the Pet Tale AI application,
                website located at pettaleai.com, and related services (collectively, the "Service").
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                By accessing or using our Service, you acknowledge that you have read, understood, and agree to be bound
                by these Terms. If you do not agree to these Terms, you must not access or use the Service.
              </p>
            </section>

            {/* Section 1 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>

              <h3 className="text-lg font-medium mt-4 mb-2">1.1 Agreement to Terms</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                By creating an account, accessing, or using Pet Tale AI, you confirm that you are at least 18 years of
                age (or the age of majority in your jurisdiction) and have the legal capacity to enter into this
                agreement. If you are using the Service on behalf of an organization, you represent and warrant that you
                have the authority to bind that organization to these Terms.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">1.2 Updates to Terms</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify you of material changes by
                posting the updated Terms on the Service and updating the "Effective Date" above. Your continued use of
                the Service after such changes constitutes your acceptance of the modified Terms.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>

              <h3 className="text-lg font-medium mt-4 mb-2">2.1 Service Overview</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Pet Tale AI is an artificial intelligence-powered platform that enables users to transform pet videos
                into narrated stories. The Service includes: (a) video upload and processing capabilities; (b)
                AI-generated voice narration using various voice styles and storytelling vibes; (c) automatically
                generated and synchronized captions; (d) shareable video links for distribution across social media and
                messaging platforms; and (e) pet profile management features.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">2.2 AI Processing</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                The Service uses artificial intelligence to analyze your uploaded videos and generate voice narration
                and captions. The original audio from your uploaded videos is replaced with AI-generated narration; the
                original audio track is not retained in the final output. Videos are processed through third-party AI
                service providers as described in our Privacy Policy.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">2.3 Service Availability</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                While we strive to maintain continuous availability, the Service is provided on an "as available" basis.
                We do not guarantee uninterrupted access and may suspend, modify, or discontinue any aspect of the
                Service at any time, with or without notice, for maintenance, updates, or other operational reasons.
              </p>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>

              <h3 className="text-lg font-medium mt-4 mb-2">3.1 Account Registration</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                To access certain features of the Service, you must create an account. You agree to provide accurate,
                current, and complete information during registration and to update such information to keep it
                accurate. You are solely responsible for maintaining the confidentiality of your account credentials and
                for all activities that occur under your account.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">3.2 Account Security</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                You must immediately notify us of any unauthorized use of your account or any other security breach. We
                will not be liable for any loss or damage arising from your failure to protect your account credentials.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">3.3 One Account Per Person</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Each individual may maintain only one account. Creating multiple accounts to abuse free credits,
                promotional offers, or for any other purpose is prohibited and may result in termination of all
                associated accounts and forfeiture of credits.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">3.4 Account Termination</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We reserve the right to suspend or terminate your account at our sole discretion, without prior notice,
                for conduct that we determine violates these Terms, is harmful to other users, or is otherwise
                objectionable. You can delete your account at any time in your account settings, or by contacting us at
                pettaleai@gmail.com (requests by email are processed within thirty (30) days). Deletion is immediate and
                permanent: any subscription is cancelled without a refund for the current billing period, unused credits
                are forfeited, and your private Pet Tales and pet information are deleted.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">4. User Content and Intellectual Property</h2>

              <h3 className="text-lg font-medium mt-4 mb-2">4.1 Your Content</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                "User Content" means any videos, images, pet profile information, text, and other materials that you
                upload, submit, or otherwise make available through the Service. You retain all ownership rights to your
                original User Content (specifically, the original video files you upload). However, by uploading User
                Content, you grant us the licenses described below.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">4.2 License Grant to Glendale AI</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                By uploading User Content to the Service, you grant Glendale AI a worldwide, non-exclusive,
                royalty-free, sublicensable, transferable, perpetual, and irrevocable license to use, reproduce, modify,
                adapt, process, create derivative works from, publish, transmit, publicly perform, publicly display,
                communicate to the public, distribute, and otherwise use your User Content for the purposes of: (a)
                operating and providing the Service; (b) generating AI narration, captions, and processed videos ("Pet
                Tales"); (c) enabling sharing functionality; (d) hosting Pet Tales indefinitely; and (e) improving and
                developing the Service.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">4.3 Pet Tales and Merged Content</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                When you use the Service to create a Pet Tale, the resulting output is a derivative work that combines
                your original video with Glendale AI's proprietary AI-generated narration and captions. You acknowledge
                and agree that:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                <li>Pet Tales constitute derivative works incorporating Glendale AI's intellectual property;</li>
                <li>
                  Glendale AI retains ownership of all AI-generated components, including voice narration and captions;
                </li>
                <li>
                  Glendale AI has the perpetual right to host, store, and make accessible all Pet Tales created through
                  the Service;
                </li>
                <li>
                  Shareable links to Pet Tales are permanent and will remain accessible even after account deletion,
                  subject to the removal provisions in Section 4.6.
                </li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">4.4 Your License to Use Pet Tales</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Subject to your compliance with these Terms, Glendale AI grants you a perpetual, worldwide,
                non-exclusive, royalty-free license to: (a) view, download, and save copies of your Pet Tales; (b) share
                Pet Tales on any platform, including social media platforms such as TikTok, Instagram, YouTube, and
                Facebook; and (c) use Pet Tales for personal, non-commercial purposes. You may download copies of your
                Pet Tales at any time while your account is active, and you are encouraged to do so.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">4.5 Persistence of Shared Content</h3>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  <strong>IMPORTANT:</strong> Shareable links to Pet Tales are designed to be permanent. Once you share
                  a link, the Pet Tale will remain accessible at that link indefinitely, including after you delete your
                  account. Account deletion removes your personal account information and private Pet Tales but does not
                  delete public Pet Tales or deactivate shared links. If you wish to remove a specific Pet Tale from
                  public access, make it private before deleting your account, or contact us at pettaleai@gmail.com.
                </p>
              </div>

              <h3 className="text-lg font-medium mt-4 mb-2">4.6 Content Removal, Moderation, and Human Review</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong>
                  Glendale AI reserves the absolute right to remove, disable, restrict access to, or delete any User
                  Content or Pet Tale at any time, for any reason or no reason, without prior notice and without
                  liability to you.
                </strong>{" "}
                This includes, but is not limited to, removal in response to: (a) DMCA takedown requests; (b) valid
                court orders or legal process; (c) privacy rights requests from identifiable individuals appearing in
                content; (d) parental requests for removal of content containing minors; (e) reports of violations of
                these Terms; (f) content that we determine, in our sole discretion, is objectionable; or (g) any other
                reason whatsoever. The permanent nature of shareable links is subject to this removal authority.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                <strong>Human Review:</strong> Your content may be reviewed by our team for quality assurance, safety,
                content moderation, or legal compliance purposes. Such review may occur before, during, or after content
                is made available through the Service.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">4.7 Community Sharing</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If you choose to make your Pet Tales publicly visible through our Community Spotlight or similar
                features, you additionally grant all users a non-exclusive license to view your shared content through
                the Service. Community content may be featured, promoted, or highlighted at Glendale AI's discretion. We
                may remove any content from community features at any time without notice.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Representations Regarding Persons in Videos</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Videos you upload may contain images, likenesses, or voices of individuals other than yourself. By
                uploading such content, you represent and warrant that:
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">5.1 Consent from Adults</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                You have obtained express consent from all identifiable adults appearing in your videos for: (a) the
                video to be uploaded to the Service; (b) the video to be processed by AI systems; (c) the resulting Pet
                Tale to be shared publicly via shareable links; and (d) the Pet Tale to be hosted indefinitely by
                Glendale AI.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">5.2 Consent for Minors</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If any minor (person under 18 years of age) appears in your videos, you represent and warrant that you
                are the parent or legal guardian of such minor, or that you have obtained express consent from the
                parent or legal guardian for the minor's appearance in the video and all uses described in Section 5.1.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">5.3 No Verification by Glendale AI</h3>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  <strong>
                    GLENDALE AI DOES NOT AND CANNOT VERIFY THAT YOU HAVE OBTAINED THE REQUIRED CONSENTS FROM INDIVIDUALS
                    APPEARING IN YOUR VIDEOS.
                  </strong>{" "}
                  We have no practical means to confirm consent and rely entirely on your representations. You assume
                  all responsibility and liability for any claims arising from unauthorized appearances, including
                  claims from individuals who did not consent to appear in your videos or Pet Tales.
                </p>
              </div>

              <h3 className="text-lg font-medium mt-4 mb-2">5.4 Third-Party Removal Requests</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Any individual who appears in a Pet Tale and did not consent to such appearance may submit a removal
                request to pettaleai@gmail.com. Glendale AI will review such requests and may, at its sole discretion,
                remove or restrict access to the relevant content without notice to you and without liability.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">5.5 Parental Rights and Minor Removal Requests</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Parents or legal guardians may request removal of content containing their minor children by contacting
                pettaleai@gmail.com. Such requests should include: (a) identification of the content; (b) your
                relationship to the minor; and (c) contact information for verification. We will review parental removal
                requests and may remove content at our discretion, giving appropriate weight to the safety and privacy
                interests of minors.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">6. AI-Generated Content Disclaimer</h2>

              <h3 className="text-lg font-medium mt-4 mb-2">6.1 Nature of AI Output</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Pet Tales are created using artificial intelligence systems that generate voice narration and captions
                based on your pet profile information and video content. AI-generated content is created algorithmically
                and may not always reflect your intentions or expectations.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">6.2 Potential Issues with AI Output</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                You acknowledge that AI-generated narration and captions may:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                <li>Contain errors, inaccuracies, or unintended content;</li>
                <li>Include language that is inappropriate, offensive, or objectionable;</li>
                <li>Not accurately reflect the personality or characteristics of your pet;</li>
                <li>Produce unexpected or undesirable results.</li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">6.3 AI Voice Resemblance Disclaimer</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong>
                  AI-generated voices are entirely synthetic and created by artificial intelligence. Any resemblance to
                  real individuals, celebrities, public figures, or any other person, living or dead, is purely
                  unintentional and coincidental.
                </strong>{" "}
                The voice styles offered (such as "tough guy," "gentle giant," "British narrator," or similar
                descriptions) are creative characterizations and are not intended to imitate or replicate any specific
                person's voice. You may not use the Service to impersonate any person or to mislead others about the
                origin, identity, or authenticity of audio content.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">6.4 No Facial Recognition or Biometric Processing</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong>
                  Pet Tale AI does not use facial recognition technology. We do not create biometric identifiers or
                  templates. We do not identify individuals through voice pattern analysis or any biometric means.
                </strong>{" "}
                While our AI analyzes video content to generate narration and captions, this analysis is focused on the
                visual scene and pet activity, not on identifying, profiling, or tracking individuals who may appear in
                the video.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">6.5 No Automated Decision-Making About Individuals</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Pet Tale AI does not use automated decision-making to evaluate, profile, score, or make determinations
                about individuals. AI processing is used solely to generate creative entertainment content based on your
                pet profile and video. No decisions affecting individuals' rights, opportunities, or access to services
                are made by our AI systems.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">6.6 User Responsibility to Review</h3>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  <strong>YOU ARE SOLELY RESPONSIBLE FOR REVIEWING ALL AI-GENERATED CONTENT BEFORE SHARING.</strong> By
                  sharing a Pet Tale, you accept full responsibility for its content, including any AI-generated
                  narration or captions. Glendale AI is not liable for any consequences arising from AI-generated
                  content that you share.
                </p>
              </div>

              <h3 className="text-lg font-medium mt-4 mb-2">6.7 Fictional Nature and No Professional Advice</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                AI-generated narration is entirely fictional and does not represent actual statements by your pet, any
                person, or Glendale AI. The narration is creative content generated for entertainment purposes only.{" "}
                <strong>
                  AI-generated content does not constitute veterinary, medical, behavioral, training, or any other
                  professional advice. You should not rely on AI-generated content for any decisions regarding pet
                  health, behavior, or care.
                </strong>
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Prohibited Conduct</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                You agree not to engage in any of the following prohibited activities:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                <li>Uploading content depicting animal abuse, cruelty, or harm;</li>
                <li>Uploading sexually explicit, violent, hateful, discriminatory, or otherwise offensive content;</li>
                <li>Uploading content featuring identifiable persons without their consent;</li>
                <li>Using AI voice features to impersonate real individuals or create misleading content;</li>
                <li>Impersonating any person or entity, or falsely representing your affiliation;</li>
                <li>Using the Service for any illegal purpose or in violation of any applicable laws;</li>
                <li>Attempting to interfere with, compromise, or disrupt the Service or servers;</li>
                <li>Circumventing any security or access controls;</li>
                <li>Using automated means (bots, scrapers) to access the Service without authorization;</li>
                <li>Uploading content that infringes intellectual property rights of others;</li>
                <li>Creating multiple accounts to abuse free credits or promotional offers;</li>
                <li>Reselling, redistributing, or commercially exploiting the Service without authorization.</li>
              </ul>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Payments, Credits, and Refunds</h2>

              <h3 className="text-lg font-medium mt-4 mb-2">8.1 Credit System</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Pet Tale AI operates on a credit-based system. In the app, credits are shown as &quot;tales.&quot; Each
                credit entitles you to create one AI-narrated Pet Tale, including voice narration, synchronized
                captions, and a shareable link. Credits are non-transferable between accounts and have no cash value.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">8.2 Free Credits</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                New users receive one (1) complimentary credit upon account creation. No other free credits are
                provided automatically. Free credits are subject to the same terms as purchased credits. We reserve the
                right to modify, suspend, or discontinue the free credit program at any time.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">8.3 Monthly Plans and Automatic Renewal</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We offer the following monthly plans (prices in USD, subject to change):
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                <li>Pet Parent: 10 credits per month for $4.99 per month</li>
                <li>Super Fan: 20 credits per month for $9.99 per month</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                <strong>Automatic renewal:</strong> Plans renew automatically each month and your payment method is
                charged the plan price at the start of each billing period until you cancel. Each paid billing period
                sets your plan credits to the plan&apos;s monthly amount. Unused plan credits do not roll over to the
                next billing period.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                <strong>Cancellation:</strong> You can cancel at any time from your account settings (Manage plan).
                Cancellation takes effect at the end of the current billing period; you keep your plan credits until
                then and will not be charged again. When the plan ends, any unused plan credits are removed. We will
                notify you before any price change takes effect, and you may cancel before the new price applies.
                Deleting your account cancels your plan immediately, without a refund for the current billing period.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                <strong>Failed payments:</strong> If a renewal payment fails, our payment processor will retry it and
                you can update your payment method from Manage plan. No new plan credits are added until the payment
                succeeds. If the payment is not resolved, the plan ends and unused plan credits are removed.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                Where offered, one-time credit packs are digital goods priced as shown at checkout. Pricing is subject
                to change, and price changes apply only to future purchases.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">8.4 Credit Validity</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Credits from one-time credit packs never expire and remain valid as long as your account is active and in good standing.
                In the event of account termination for violation of these Terms, any unused credits may be forfeited
                without refund.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">8.5 Payment Processing</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                All payments are processed securely through our third-party payment processor. By making a purchase, you
                agree to the payment processor's terms of service and privacy policy. We do not store your complete
                payment card information on our servers. You are responsible for any fees charged by your payment
                provider, including currency conversion fees.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">8.6 Refund Policy</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong>Digital Goods:</strong> Plan credits and credit packs are digital goods delivered immediately
                upon payment. As such, plan charges and pack purchases are final and non-refundable, including partial
                billing periods after cancellation, except as required by applicable law or as expressly provided
                below.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                <strong>Technical Failures:</strong> If a credit is consumed but the Service fails to generate your Pet
                Tale due to a technical error on our part (not due to user error, unsupported file format, or content
                violations), we will restore the credit to your account. If processing cannot start, the credit is
                restored automatically. Otherwise, please report the failure to pettaleai@gmail.com within seven (7)
                days. Restoring the credit is our sole remedy for technical failures, except where the law requires
                otherwise.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                <strong>Duplicate Charges:</strong> If you are charged multiple times for the same transaction in error,
                we will refund the duplicate charges upon verification.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                <strong>Dissatisfaction with AI Output:</strong> Because AI-generated content is subjective and results
                may vary, we do not offer refunds or credit restoration for dissatisfaction with the creative output,
                voice selection, or caption quality. We encourage you to use your free credit to try the Service before
                purchasing.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                <strong>Discretionary Refunds:</strong> We may, at our sole discretion, offer refunds, credits, or other
                accommodations in exceptional circumstances on a case-by-case basis.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                <strong>Effect of Refunds and Chargebacks:</strong> If a payment is refunded, or reversed through a
                chargeback or payment dispute, the unused credits from that payment are removed from your account.
                Credits already used are not affected. For a refunded monthly plan payment, the remaining plan credits
                for that billing period are removed. We may suspend accounts with repeated or unfounded chargebacks.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                <strong>Consumers in the EU, UK and similar jurisdictions:</strong> You may have a statutory right to
                withdraw from a purchase of digital content within 14 days. By purchasing credits, you ask us to supply
                them immediately, and you acknowledge that you lose the right to withdraw once you use a purchased
                credit. You may still withdraw from a purchase within 14 days if you have not used any of the credits
                from it.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                <strong>How to Request a Refund:</strong> Email pettaleai@gmail.com from your account email with the
                date of the charge. Approved refunds are returned to your original payment method.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">8.7 Taxes</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Prices may be exclusive of applicable taxes. You are responsible for any sales tax, use tax, value-added
                tax (VAT), or similar taxes imposed by your jurisdiction.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">8.8 Credits Upon Account Termination</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If you voluntarily delete your account, any unused credits will be forfeited. If we terminate your
                account for cause (violation of these Terms), credits are forfeited without refund. If we discontinue
                the Service entirely, we will provide reasonable notice and may, at our discretion, offer refunds for
                unused purchased credits.
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Intellectual Property Rights</h2>

              <h3 className="text-lg font-medium mt-4 mb-2">9.1 Our Intellectual Property</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                The Service, including its design, features, functionality, software, text, graphics, logos, trademarks,
                AI models, voice synthesis technology, and all algorithms (collectively, "Glendale AI IP"), is owned by
                Glendale AI or its licensors and is protected by intellectual property laws. These Terms do not grant
                you any right, title, or interest in the Glendale AI IP except for the limited license to use the
                Service as expressly provided herein.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">9.2 Trademarks</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                "Pet Tale AI," "Pet Tales," the Pet Tale AI logo, and other marks are trademarks or service marks of
                Glendale AI. You may not use these marks without our prior written permission.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">9.3 Feedback</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If you provide us with any feedback, suggestions, or ideas regarding the Service ("Feedback"), you
                hereby assign to us all rights in such Feedback and agree that we may use it without restriction or
                compensation to you.
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Copyright Infringement and DMCA</h2>

              <h3 className="text-lg font-medium mt-4 mb-2">10.1 Respect for Copyright</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We respect the intellectual property rights of others and expect our users to do the same. We respond to
                notices of alleged copyright infringement that comply with applicable law.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">10.2 DMCA Takedown Procedure</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If you believe that your copyrighted work has been copied in a way that constitutes copyright
                infringement, please provide a written notification to pettaleai@gmail.com containing: (a) your physical
                or electronic signature; (b) identification of the copyrighted work claimed to have been infringed; (c)
                identification of the material that is claimed to be infringing and its location on the Service; (d)
                your contact information; (e) a statement that you have a good faith belief that use of the material is
                not authorized by the copyright owner; and (f) a statement, under penalty of perjury, that the
                information in the notification is accurate and that you are authorized to act on behalf of the
                copyright owner.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">10.3 Counter-Notification</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If you believe your content was wrongly removed, you may submit a counter-notification to
                pettaleai@gmail.com containing: (a) your physical or electronic signature; (b) identification of the
                removed material and its prior location; (c) a statement under penalty of perjury that you have a good
                faith belief that the material was removed by mistake or misidentification; (d) your name, address, and
                telephone number; and (e) consent to jurisdiction of federal court in your district.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">10.4 Repeat Infringer Policy</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We will terminate the accounts of users who are determined to be repeat infringers.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">10.5 DMCA After Account Deletion</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                DMCA takedown procedures continue to apply to Pet Tales that remain accessible after account deletion.
                If we receive a valid DMCA notice regarding content from a deleted account, the content will be removed
                in accordance with our standard procedures.
              </p>
            </section>

            {/* Section 11 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Privacy</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Your privacy is important to us. Our collection, use, and disclosure of personal information is governed
                by our{" "}
                <Link href="/privacy" className="text-teal-600 hover:underline">
                  Privacy Policy
                </Link>
                , which is incorporated into these Terms by reference. By using the Service, you consent to our data
                practices as described in the Privacy Policy.
              </p>
            </section>

            {/* Section 12 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">12. Disclaimers</h2>
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
                  IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, GLENDALE AI DISCLAIMS ALL WARRANTIES, INCLUDING BUT
                  NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
                  NON-INFRINGEMENT.
                </p>
              </div>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                We do not warrant that: (a) the Service will meet your requirements; (b) the Service will be
                uninterrupted, timely, secure, or error-free; (c) the results obtained from the Service will be accurate
                or reliable; (d) the quality of any AI-generated content will meet your expectations; or (e) any errors
                in the Service will be corrected.
              </p>
            </section>

            {/* Section 13 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">13. Limitation of Liability</h2>
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL GLENDALE AI, ITS OFFICERS,
                  DIRECTORS, EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
                  CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL,
                  OR OTHER INTANGIBLE LOSSES, RESULTING FROM: (A) YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE
                  THE SERVICE; (B) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE; (C) ANY CONTENT OBTAINED
                  FROM THE SERVICE, INCLUDING AI-GENERATED CONTENT; (D) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR
                  TRANSMISSIONS OR CONTENT; (E) THE PERSISTENCE, REMOVAL, OR AVAILABILITY OF SHARED LINKS; OR (F) ANY
                  RESEMBLANCE OF AI-GENERATED VOICES TO REAL INDIVIDUALS.
                </p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mt-4">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                  OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATING TO THESE TERMS OR YOUR USE OF THE
                  SERVICE SHALL NOT EXCEED THE GREATER OF: (A) THE AMOUNTS YOU HAVE PAID TO US IN THE TWELVE (12) MONTHS
                  PRIOR TO THE CLAIM; OR (B) ONE HUNDRED UNITED STATES DOLLARS ($100 USD).
                </p>
              </div>
            </section>

            {/* Section 14 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">14. Indemnification</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                You agree to indemnify, defend, and hold harmless Glendale AI and its officers, directors, employees,
                agents, and licensors from and against any and all claims, damages, losses, liabilities, costs, and
                expenses (including reasonable attorneys' fees) arising out of or related to: (a) your use of the
                Service; (b) your User Content, including any claims by third parties appearing in your videos; (c) your
                violation of these Terms; (d) your violation of any third-party rights, including intellectual property
                rights, privacy rights, or publicity rights; (e) any claim that your User Content caused damage to a
                third party; (f) your failure to obtain required consents from persons appearing in your videos; or (g)
                any claim arising from AI-generated content that you shared or distributed.
              </p>
            </section>

            {/* Section 15 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">15. Dispute Resolution</h2>

              <h3 className="text-lg font-medium mt-4 mb-2">15.1 Informal Resolution</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Before initiating any formal dispute resolution proceeding, you agree to first contact us at
                pettaleai@gmail.com and attempt to resolve any dispute informally for at least thirty (30) days.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">15.2 Binding Arbitration</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If we cannot resolve a dispute informally, any dispute, claim, or controversy arising out of or relating
                to these Terms or the Service shall be resolved by binding arbitration administered by the American
                Arbitration Association ("AAA") in accordance with its Consumer Arbitration Rules. The arbitration shall
                be conducted in the State of New Jersey. Judgment on the arbitration award may be entered in any court
                having jurisdiction.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">15.3 Arbitration Opt-Out</h3>
              <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  <strong>You may opt out of the agreement to arbitrate.</strong> To opt out, you must send written
                  notice to pettaleai@gmail.com within thirty (30) days of first accepting these Terms. Your notice must
                  include: (a) your name; (b) the email address associated with your account; and (c) a clear statement
                  that you wish to opt out of the arbitration agreement. If you opt out, you and Glendale AI may pursue
                  claims against each other in court. Opting out of arbitration will not affect any other provisions of
                  these Terms.
                </p>
              </div>

              <h3 className="text-lg font-medium mt-4 mb-2">15.4 Class Action Waiver</h3>
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                  YOU AND GLENDALE AI AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL
                  CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING.
                </p>
              </div>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                If you have opted out of arbitration, this class action waiver still applies to any court proceedings
                between us.
              </p>
            </section>

            {/* Section 16 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">16. General Provisions</h2>

              <h3 className="text-lg font-medium mt-4 mb-2">16.1 Governing Law</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the State of New Jersey,
                without regard to its conflict of law provisions.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">16.2 Entire Agreement</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                These Terms, together with our Privacy Policy, constitute the entire agreement between you and Glendale
                AI regarding the Service.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">16.3 Severability</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If any provision of these Terms is held to be invalid or unenforceable, such provision shall be struck
                and the remaining provisions shall continue in full force and effect.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">16.4 Waiver</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Our failure to enforce any right or provision of these Terms shall not be considered a waiver of such
                right or provision.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">16.5 Assignment</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                You may not assign or transfer these Terms without our prior written consent. We may freely assign these
                Terms without restriction.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">16.6 Modifications to Service</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We reserve the right to modify, suspend, or discontinue any feature, functionality, or aspect of the
                Service at any time, with or without notice. This includes the right to add, remove, or change voice
                styles, storytelling vibes, and other Service features.
              </p>
            </section>

            {/* Section 17 */}
            <section className="bg-teal-50 dark:bg-teal-900/20 p-6 rounded-lg">
              <h2 className="text-2xl font-semibold mb-4">17. Contact Information</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If you have any questions about these Terms of Service, please contact us:
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
            </section>

            {/* Acknowledgment */}
            <section className="border-t pt-8">
              <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed font-medium text-center italic">
                  BY USING PET TALE AI, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE
                  TERMS OF SERVICE.
                </p>
              </div>
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
