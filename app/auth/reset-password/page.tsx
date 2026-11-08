import type { Metadata } from "next"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return (
    <div className="container flex min-h-screen w-screen flex-col items-center justify-center px-4 py-8">
      <div className="mx-auto flex w-full flex-col justify-center sm:w-[400px]">
        <ResetPasswordForm />
      </div>
    </div>
  )
}
