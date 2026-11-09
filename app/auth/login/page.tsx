import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"
import { PublicFooter } from "@/components/public-footer"

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Pet Tale AI account to create AI-narrated pet videos.",
  alternates: {
    canonical: "https://www.pettaleai.com/auth/login",
  },
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  // Get the redirectTo parameter from the URL
  const redirectTo = searchParams?.redirectTo as string | undefined

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1 flex-col px-5 pb-10 pt-3 sm:items-center sm:justify-center sm:pt-10">
        <div className="mx-auto w-full max-w-sm">
          <LoginForm redirectTo={redirectTo} />
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
