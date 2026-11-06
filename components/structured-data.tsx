export function StructuredData() {
  const siteUrl = "https://www.pettaleai.com"

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Pet Tale AI",
    legalName: "Glendale AI, LLC",
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description:
      "AI-powered pet video narration platform that transforms pet videos into shareable stories with voice narration and captions.",
    contactPoint: {
      "@type": "ContactPoint",
      email: "pettaleai@gmail.com",
      contactType: "customer service",
    },
  }

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Pet Tale AI",
    url: siteUrl,
    description: "Transform pet videos into shareable stories with AI voice narration and perfectly timed captions.",
  }

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Pet Tale AI",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    url: siteUrl,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "First tale free, then 1 free tale per month. Plans from $4.99 a month.",
    },
    featureList: [
      "AI voice narration",
      "Automatic captions",
      "12 unique voice styles",
      "6 storytelling vibes",
      "One shareable link",
      "Works on all platforms",
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
    </>
  )
}
