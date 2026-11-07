import type { Metadata } from "next"
import { SignupForm } from "@/components/auth/signup-form"
import { PublicFooter } from "@/components/public-footer"

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Join Pet Tale AI free - Your first tale is free. Create AI-narrated pet videos in minutes.",
  alternates: {
    canonical: "https://www.pettaleai.com/auth/signup",
  },
  openGraph: {
    title: "Join Pet Tale AI Free",
    description: "Your first tale is free. Create AI-narrated pet videos in minutes.",
  },
}

export default function SignupPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  // Get the redirectTo parameter from the URL
  const redirectTo = searchParams?.redirectTo as string | undefined

  return (
    <div className="flex flex-col min-h-screen">
      <div className="container flex flex-1 w-screen flex-col items-center justify-center px-4 py-8">
        <div className="mx-auto flex w-full flex-col justify-center sm:w-[400px]">
          <SignupForm redirectTo={redirectTo} />
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
