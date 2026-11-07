import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ProfileForm } from "@/components/settings/profile-form"
import { ChangePasswordForm } from "@/components/settings/change-password-form"
import { SubscriptionCard } from "@/components/settings/subscription-card"
import { DangerZone } from "@/components/settings/danger-zone"
import { SignOutButton } from "@/components/settings/sign-out-button"
import { getUserDetails } from "@/lib/supabase/server"
import { Settings, User, CreditCard, Shield } from "lucide-react"

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your Pet Tale AI account settings and preferences",
}

export const dynamic = "force-dynamic"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string; session_id?: string; success?: string }
}) {
  const user = await getUserDetails()

  // Default to 'billing' tab if coming from successful checkout, otherwise 'profile'
  const activeTab = searchParams.tab || (searchParams.session_id ? "billing" : "profile")

  return (
    <div className="container max-w-4xl mx-auto py-6 sm:py-8 px-4">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-7 w-7 sm:h-8 sm:w-8 text-teal-600" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Manage your account and preferences.
          </p>
        </div>
        <SignOutButton />
      </div>

      <Tabs defaultValue={activeTab} className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg h-auto">
          <TabsTrigger
            value="profile"
            className="flex items-center justify-center gap-2 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-800"
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger
            value="account"
            className="flex items-center justify-center gap-2 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-800"
          >
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
          <TabsTrigger
            value="billing"
            className="flex items-center justify-center gap-2 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-800"
          >
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Billing</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4 sm:space-y-6">
          <ProfileForm user={user} />
        </TabsContent>

        <TabsContent value="account" className="space-y-4 sm:space-y-6">
          {/* Change Password */}
          <ChangePasswordForm />

          {/* Email Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="text-xl">📧</span>
                <CardTitle>Email Address</CardTitle>
              </div>
              <CardDescription>Your login email</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">Current Email</h4>
                  <p className="text-sm text-muted-foreground break-all">{user?.email || "No email set"}</p>
                </div>
                <Button variant="outline" size="sm" className="w-full sm:w-auto sm:min-w-[120px] bg-transparent">
                  Change Email
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                Note: Changing your email requires verification.
              </p>
            </CardContent>
          </Card>

          <DangerZone />
        </TabsContent>

        <TabsContent value="billing" className="space-y-4 sm:space-y-6">
          <SubscriptionCard user={user} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
