import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/api/", "/auth/callback", "/auth/reset-password"],
      },
    ],
    sitemap: "https://www.pettaleai.com/sitemap.xml",
  }
}
