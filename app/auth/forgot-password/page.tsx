import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const dynamic = "force-dynamic"

export default function ForgotPasswordPage() {
  return (
    <div className="container flex min-h-screen w-screen flex-col items-center justify-center px-4 py-8">
      <div className="mx-auto flex w-full flex-col justify-center sm:w-[400px]">
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
