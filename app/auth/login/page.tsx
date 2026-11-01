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
      <div className="container flex flex-1 w-screen flex-col items-center justify-center px-4 py-8">
        <div className="mx-auto flex w-full flex-col justify-center sm:w-[400px]">
          <LoginForm redirectTo={redirectTo} />
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
