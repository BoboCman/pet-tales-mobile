import type { Metadata } from "next"
import { PrivacyChoices } from "./privacy-choices"

export const metadata: Metadata = {
  title: "Your Privacy Choices",
  description: "Turn off ad tracking on Pet Tale AI.",
  alternates: { canonical: "https://www.pettaleai.com/privacy/choices" },
  robots: { index: false, follow: false },
}

export default function PrivacyChoicesPage() {
  return <PrivacyChoices />
}
