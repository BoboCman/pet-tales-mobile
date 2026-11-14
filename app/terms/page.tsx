import Link from "next/link"
import type { Metadata } from "next"
import { LegalPage, LegalSection, ContactEmail } from "@/components/legal/legal-page"
import { LEGAL_VERSIONS } from "@/lib/constants/legal"
import { FREE_TIER, packLabel, subscriptionPlans } from "@/lib/pricing-config"
import { getPackOffer } from "@/lib/stripe/pack-offer"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The plain-language terms for using Pet Tale AI, run by Glendale AI, LLC.",
  alternates: {
    canonical: "https://www.pettaleai.com/terms",
  },
  robots: {
    index: true,
    follow: false,
  },
}

export const dynamic = "force-dynamic"

export default async function TermsPage() {
  const pack = await getPackOffer()
  return (
    <LegalPage
      title="Terms of Service"
      effectiveDate={LEGAL_VERSIONS.EFFECTIVE_DATE}
      intro={
        <>
          <p>
            Welcome to Pet Tale AI! We built Pet Tale so pet families can turn everyday clips into little stories
            worth sharing. These terms are the agreement between you and Glendale AI, LLC, a New Jersey company that
            runs Pet Tale AI at pettaleai.com (&ldquo;we&rdquo; or &ldquo;us&rdquo;).
          </p>
          <p>
            We&apos;ve kept them as short and plain as we can. By creating an account or using Pet Tale, you agree to
            these terms and to our <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </>
      }
      nutshell={[
        "You own your videos. We use them to make, store and show your tales.",
        "Only upload clips you're allowed to use, including any music, other people's footage, and anyone who appears in them.",
        "Share your tales anywhere, including on creator accounts that earn money. Paid ads need our okay first.",
        "Tales are made by AI, so give each one a quick look before you share it.",
        "Plans renew monthly until you cancel in Settings. Pack tales never expire.",
        "Payments are non-refundable, but if a tale fails on our side, you get that tale back.",
        "If we ever disagree, we'll try to sort it out together first. If that fails, it goes to individual arbitration, unless you opt out within 30 days.",
      ]}
    >
      <LegalSection id="who" title="1. Who can use Pet Tale">
        <p>
          You need to be at least 18 (or the age of majority where you live) to create an account. One account per
          person, please. Keep your password to yourself, and let us know right away if you think someone else got
          into your account. You&apos;re responsible for what happens in your account.
        </p>
      </LegalSection>

      <LegalSection id="what" title="2. What Pet Tale does">
        <p>
          You upload a clip of your pet, and Pet Tale uses AI to turn it into a short tale you can share. Tales made
          with your free tale carry a small pettaleai.com mark.
        </p>
        <p>
          We&apos;re always improving Pet Tale, so features, voices and vibes may change or be retired. We work hard to
          keep things running, but Pet Tale may sometimes be down for maintenance or hiccups.
        </p>
      </LegalSection>

      <LegalSection id="content" title="3. Your videos and your tales">
        <p>
          <strong>You own what you upload</strong>: your clips, photos and your pet&apos;s details. To make and show
          your tales, you give us permission to store, copy, process, edit and display that content, and to share it
          with the services that help us make tales (listed in our <Link href="/privacy">Privacy Policy</Link>). This
          permission is free, worldwide, and lasts while your content is on Pet Tale. We also use it to keep Pet Tale
          working well and to make it better.
        </p>
        <p>
          <strong>Your tales are made to share.</strong> Download them, keep them, and post them anywhere, including
          on your own social or creator accounts that earn money from views or platform programs. What needs our
          written okay first: using a tale in paid advertising, selling or licensing tales as a product, or offering
          Pet Tale&apos;s voices or tale-making to others as a service. Pet Tale itself, our voices and the technology
          behind it stay ours.
        </p>
        <p>
          <strong>About AI-made parts.</strong> Your own footage stays yours. The narration, voice and captions are
          made by AI, and the law may not treat AI-made material as anyone&apos;s exclusive property, so we can&apos;t
          promise those parts are unique to you or protected by copyright.
        </p>
        <p>
          <strong>Private, shared and public tales.</strong> A tale is private until you share it. Anyone with a share
          link can watch that tale. If you make a tale public, it shows in our Community, and you let us feature it on
          Pet Tale and in our own unpaid social media posts until you make it private again or ask us to take it
          down. We&apos;ll always ask you first before using your tale in paid advertising. Public tales and
          share links keep working after you delete your account, unless you make them private first or ask us to
          remove them.
        </p>
        <p>
          <strong>Keeping things safe.</strong> Our team may look at tales to keep Pet Tale safe and working well. We
          may remove any content that breaks these terms, or after a valid legal, copyright or privacy request.
        </p>
      </LegalSection>

      <LegalSection id="people" title="4. People in your videos">
        <p>
          Pets are the stars, but family and friends sometimes make a cameo. By uploading a clip, you confirm you have
          the rights and permissions needed to turn it into a tale and share it. That includes everyone who appears
          in it, any music playing in it, and any footage that someone else made. If a child appears, you need to be their
          parent or guardian, or have their parent&apos;s permission. We can&apos;t check this for you, so it&apos;s
          your responsibility.
        </p>
        <p>
          Anyone who appears in a tale and wants it taken down, or a parent asking about their child, can email{" "}
          <ContactEmail />. Tell us which tale and how you&apos;re connected to it, and we&apos;ll review it quickly.
        </p>
      </LegalSection>

      <LegalSection id="ai" title="5. About AI tales">
        <ul>
          <li>Tales are fiction, made for fun. They aren&apos;t real statements from your pet, anyone else, or us.</li>
          <li>
            AI can get things wrong, miss the moment, or say something odd. Please watch each tale before you share
            it. You&apos;re responsible for what you share.
          </li>
          <li>
            Our voices are synthetic characters. They aren&apos;t meant to sound like any real person, and you
            may not use them to impersonate anyone.
          </li>
          <li>Tales aren&apos;t veterinary, training or any other professional advice.</li>
          <li>We don&apos;t use facial recognition, and we don&apos;t identify the people in your clips.</li>
        </ul>
      </LegalSection>

      <LegalSection id="rules" title="6. Please don't">
        <ul>
          <li>Upload anything showing animal cruelty or harm.</li>
          <li>Upload sexual, violent, hateful or harassing content.</li>
          <li>Upload content you don&apos;t have the rights to, or that shows people without their okay.</li>
          <li>Use Pet Tale to impersonate someone, mislead people, or break the law.</li>
          <li>Hack, overload, scrape or work around the security of Pet Tale.</li>
          <li>Copy, reverse engineer or try to extract how Pet Tale works, or use it to build a competing product.</li>
          <li>Create extra accounts to get more free tales, or resell Pet Tale without our permission.</li>
        </ul>
        <p>If you do, we may remove content or suspend your account.</p>
      </LegalSection>

      <LegalSection id="payments" title="7. Plans, packs and payments">
        <p>
          <strong>Tales.</strong> Each tale you make uses one tale from your balance. Tales have no cash value and
          can&apos;t be transferred. New accounts get {FREE_TIER.welcomeTales} free tale.
        </p>
        <p>
          <strong>Monthly plans</strong> (prices in US dollars; we may change them, see below):
        </p>
        <ul>
          {subscriptionPlans.map((plan) => (
            <li key={plan.id}>
              {plan.name}: {plan.talesPerMonth} tales a month for ${plan.monthlyPrice.toFixed(2)} a month
            </li>
          ))}
        </ul>
        <p>
          Plans renew automatically. We charge your card the plan price at the start of each monthly period until you
          cancel. Unused plan tales roll over to the next month, up to two months&apos; worth. Cancel anytime in
          Settings (Manage plan). You keep your plan and its tales until the end of the period you paid for, and you
          won&apos;t be charged again. When a plan ends, any unused plan tales end with it.
        </p>
        <p>
          If a renewal payment fails, our payment processor will try again, and you can update your card in Manage
          plan. No new plan tales are added until the payment goes through. If it isn&apos;t resolved, the plan ends.
          We&apos;ll tell you before any price change, so you can cancel before it applies.
        </p>
        <p>
          <strong>Tale packs</strong> are a one-time purchase at the price shown at checkout
          {pack ? ` (right now, ${packLabel(pack)})` : ""}. Pack tales never expire
          while your account is open. We use your plan tales first, so pack tales stay saved for later.
        </p>
        <p>
          <strong>Refunds.</strong> Tales are delivered the moment you pay, so payments are non-refundable, including
          partial months after you cancel. A few exceptions:
        </p>
        <ul>
          <li>
            If a tale fails because of a problem on our side, we give that tale back. It&apos;s automatic when a tale
            can&apos;t start. Otherwise, email us within 7 days.
          </li>
          <li>If you&apos;re charged twice by mistake, we refund the extra charge.</li>
          <li>
            If you live in the EU or UK, you can cancel a purchase within 14 days as long as you haven&apos;t used any
            of its tales.
          </li>
          <li>We&apos;re happy to help in special cases. Just ask.</li>
        </ul>
        <p>
          We can&apos;t refund a tale because you didn&apos;t love how it turned out, so please use your free tale to
          try Pet Tale first. If a payment is refunded or disputed, the unused tales from it are removed. To ask for a
          refund, email <ContactEmail /> from your account email with the date of the charge.
        </p>
        <p>
          Payments are handled by Stripe, and we never see your full card number. Prices may not include taxes where
          they apply.
        </p>
      </LegalSection>

      <LegalSection id="account" title="8. Closing your account">
        <p>
          You can delete your account anytime in Settings, or email us and we&apos;ll do it within 30 days. Deleting
          your account cancels any plan right away, with no refund for the current month, and unused tales are lost.
          Your private tales and pet info are deleted. Public tales stay up unless you make them private first or ask
          us to remove them.
        </p>
        <p>
          We may suspend or close an account that breaks these terms or puts others at risk. If we do, unused tales
          may be lost. If we ever shut Pet Tale down, we&apos;ll give you reasonable notice.
        </p>
      </LegalSection>

      <LegalSection id="ours" title="9. Our name and ideas">
        <p>
          &ldquo;Pet Tale AI,&rdquo; our logo and the app belong to Glendale AI, LLC. Please don&apos;t use them
          without our permission. If you send us ideas or feedback, thank you! We may use them freely, with no
          obligation to you.
        </p>
      </LegalSection>

      <LegalSection id="copyright" title="10. Copyright complaints">
        <p>
          If you believe a tale uses your copyrighted work without permission, email <ContactEmail /> with: your
          name, contact info and signature; the work you own; the tale and where it appears; a statement that you
          believe in good faith the use isn&apos;t authorized; and a statement, under penalty of perjury, that your
          notice is accurate and you&apos;re the owner or authorized to act for them.
        </p>
        <p>
          If your content was removed by mistake, you can send a counter-notice with your name, address and phone
          number, the removed content, a statement under penalty of perjury that it was removed by mistake, and your
          consent to the jurisdiction of the federal court in your district. We close the accounts of repeat
          infringers.
        </p>
      </LegalSection>

      <LegalSection id="legal" title="11. The legal limits">
        <p>
          <strong>
            Pet Tale is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; To the fullest extent the law
            allows, we make no warranties, express or implied, including warranties of merchantability, fitness for a
            particular purpose and non-infringement. We don&apos;t promise that Pet Tale will always be available or
            error-free, or that AI tales will turn out the way you hope.
          </strong>
        </p>
        <p>
          <strong>
            To the fullest extent the law allows, we aren&apos;t liable for indirect, incidental, special,
            consequential or punitive damages, or for lost profits or data. Our total liability for any claim is
            limited to the greater of what you paid us in the 12 months before the claim, or $100.
          </strong>
        </p>
        <p>
          If someone brings a claim against us because of content you uploaded or shared, or because you broke these
          terms, you agree to cover our reasonable losses and costs, including legal fees.
        </p>
        <p>
          Nothing in these terms takes away rights you have under the law that can&apos;t be waived or limited,
          including your rights as a consumer under New Jersey law.
        </p>
      </LegalSection>

      <LegalSection id="disputes" title="12. If we disagree">
        <p>
          <strong>Talk to us first.</strong> Most problems can be fixed with a quick email. Please contact{" "}
          <ContactEmail /> and give us 30 days to try to make it right.
        </p>
        <p>
          <strong>Arbitration.</strong> If we can&apos;t work it out, you and we agree to settle the dispute through
          binding arbitration on an individual basis instead of in court.{" "}
          <strong>
            This means you and we each give up the right to sue in court and to have a judge or jury decide the
            dispute.
          </strong>{" "}
          The American Arbitration Association runs it under its Consumer Arbitration Rules, in New Jersey or by video
          or phone. Either of us can still take an eligible claim to small claims court.
        </p>
        <p>
          <strong>No class actions.</strong> Claims can only be brought individually, not as part of a class or group
          case. This applies even if you opt out of arbitration.
        </p>
        <p>
          <strong>Opting out.</strong> You can opt out of arbitration by emailing <ContactEmail /> within 30 days of
          creating your account. Include your name, your account email and a note saying you&apos;re opting out of
          arbitration. Everything else in these terms still applies.
        </p>
        <p>New Jersey law governs these terms, without regard to conflict-of-law rules.</p>
      </LegalSection>

      <LegalSection id="changes" title="13. Changes and the fine details">
        <p>
          If we update these terms, we&apos;ll post the new version here and change the date at the top. For big
          changes, we&apos;ll also email you or show a notice in the app before they take effect. If you keep using Pet
          Tale after that, you accept the new terms.
        </p>
        <p>
          These terms and our Privacy Policy are the whole agreement between us. If any part turns out to be
          unenforceable, the rest still applies. If we don&apos;t enforce something right away, we haven&apos;t given
          up the right to. We may transfer these terms if Pet Tale is sold or merged. You need our okay to transfer
          them.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="14. Contact us">
        <p>
          Questions, ideas or a great pet story? We&apos;d love to hear from you at <ContactEmail />.
        </p>
        <p>Glendale AI, LLC · New Jersey, USA · pettaleai.com</p>
      </LegalSection>
    </LegalPage>
  )
}
