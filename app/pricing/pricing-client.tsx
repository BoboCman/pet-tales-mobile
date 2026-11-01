"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Coins, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CreditPack } from "@/lib/stripe/pack-config"
import { isStripeTestMode } from "@/lib/stripe/test-mode"

interface PricingClientProps {
  packs: CreditPack[]
}

export default function PricingClient({ packs }: PricingClientProps) {
  const [purchasingPackId, setPurchasingPackId] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const { toast } = useToast()
  const searchParams = useSearchParams()

  useEffect(() => {
    const sessionId = searchParams.get("session_id")
    const packPurchase = searchParams.get("pack_purchase")

    if (sessionId && packPurchase === "success") {
      toast({
        title: "🎉 Credits added successfully!",
        description: "Your credits have been added to your account. Start creating tales!",
        duration: 6000,
      })

      window.history.replaceState({}, "", "/pricing")
    }
  }, [searchParams, toast])

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handlePackCheckout = async (packId: string) => {
    setPurchasingPackId(packId)

    toast({
      title: "Redirecting to checkout...",
      description: "Please wait while we prepare your checkout session.",
    })

    try {
      const res = await fetch("/api/stripe/create-pack-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack_id: packId }),
      })

      if (!res.ok) {
        const error = await res.json()
        toast({
          title: "Checkout failed",
          description: error.message || "Failed to create checkout session",
          variant: "destructive",
        })
        setPurchasingPackId(null)
        return
      }

      const data = await res.json()

      window.location.href = data.url
    } catch (error) {
      console.error("Checkout error:", error)
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      })
      setPurchasingPackId(null)
    }
  }

  return (
    <>
      {isStripeTestMode() && (
        <div className="bg-amber-50 border-b-2 border-amber-300">
          <div className="container max-w-6xl mx-auto px-4 py-6">
            <Alert className="border-2 border-amber-300 bg-white shadow-lg">
              <AlertCircle className="h-6 w-6 text-amber-600" />
              <AlertTitle className="text-xl font-bold text-amber-900 mb-3 flex items-center gap-2">
                🎁 Friends & Family Preview
              </AlertTitle>
              <AlertDescription className="space-y-3">
                <p className="text-amber-800 font-medium">
                  Thanks for testing! Checkout shows $3.99 (our launch price), but don't worry—no real charges during
                  preview. Use the test card below.
                </p>

                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-4 rounded-lg border-2 border-amber-200">
                  <p className="font-bold text-amber-900 mb-2">
                    💳 Test Card: 4242 4242 4242 4242 | Exp: 12/34 | CVC: 123 | ZIP: 12345
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-12 md:py-20 pb-24 md:pb-20">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 bg-teal-100 text-teal-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            Help Us Test Checkout
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
            Try the Full Purchase Experience
          </h1>

          <p className="text-base md:text-lg text-gray-700 max-w-2xl mx-auto font-medium">
            We're testing our checkout flow before launch. Walk through the process and get 5 real credits to create
            tales.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto mb-16">
          {packs.map((pack) => {
            const priceInDollars = (pack.price_cents / 100).toFixed(2)
            const costPerTale = (pack.price_cents / 100 / pack.credits).toFixed(2)
            const isPurchasing = purchasingPackId === pack.id

            const packageName =
              pack.id === "quick_fix" ? "Preview Pack" : pack.id === "party_pack" ? "Memory Pack" : "Family Pack"

            if (pack.id === "party_pack" || pack.id === "creator_bundle") {
              return null
            }

            return (
              <Card
                key={pack.id}
                className={cn(
                  "relative flex flex-col transition-all duration-200",
                  "hover:shadow-xl hover:-translate-y-1 hover:border-teal-300",
                )}
              >
                <CardHeader className="text-center pb-6 pt-8">
                  <div
                    className={cn(
                      "mx-auto mb-4 h-16 w-16 rounded-full flex items-center justify-center",
                      pack.popular ? "bg-gradient-to-br from-teal-100 to-emerald-100" : "bg-teal-50",
                    )}
                  >
                    <Coins className={cn("h-8 w-8", pack.popular ? "text-teal-600" : "text-teal-500")} />
                  </div>

                  <CardTitle className="text-2xl md:text-3xl font-bold mb-2">{packageName}</CardTitle>

                  <CardDescription className="text-base">
                    {pack.id === "quick_fix" && "Test checkout and get 5 credits"}
                    {pack.id === "party_pack" && "Capture more moments and try different voices."}
                    {pack.id === "creator_bundle" && "Best value for pet parents with lots of moments to share."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 text-center space-y-6">
                  <div>
                    <div className="text-5xl md:text-6xl font-bold text-teal-600 mb-1">{pack.credits}</div>
                    <div className="text-sm text-muted-foreground font-medium">credits</div>
                  </div>

                  {isStripeTestMode() ? (
                    <div>
                      <div className="text-5xl font-bold">$3.99</div>
                      <div className="text-sm text-muted-foreground mt-2 font-medium">No charge in test mode</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-5xl font-bold">${priceInDollars}</div>
                      <div className="text-sm text-muted-foreground mt-1">${costPerTale} per tale</div>
                    </div>
                  )}

                  <ul className="space-y-3 text-left">
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-teal-600 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">AI narration in your pet's voice</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-teal-600 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Captions that tell the story</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-teal-600 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Personality-matched tone</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-teal-600 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">One link—share anywhere</span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-teal-600 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Credits never expire</span>
                    </li>
                  </ul>
                </CardContent>

                <CardFooter className="pt-0">
                  <Button
                    onClick={() => handlePackCheckout(pack.id)}
                    disabled={isPurchasing}
                    className={cn(
                      "w-full h-12 text-base font-semibold transition-all hover:scale-105 active:scale-95",
                      pack.popular
                        ? "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700"
                        : "bg-teal-600 hover:bg-teal-700",
                    )}
                  >
                    {isPurchasing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Coins className="mr-2 h-5 w-5" />
                        Test Checkout
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-white rounded-lg border p-8 shadow-sm">
            <h3 className="text-2xl font-bold mb-4">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <div className="text-3xl font-bold text-teal-600 mb-2">1</div>
                <p className="font-semibold mb-1">Click 'Test Checkout'</p>
                <p className="text-muted-foreground">Start the purchase flow</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-teal-600 mb-2">2</div>
                <p className="font-semibold mb-1">Enter test card info</p>
                <p className="text-muted-foreground">4242 4242 4242 4242 • Any future date • Any CVC</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-teal-600 mb-2">3</div>
                <p className="font-semibold mb-1">Get your credits</p>
                <p className="text-muted-foreground">5 credits added instantly—start creating tales</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
