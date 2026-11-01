"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Heart, Sparkles, Users } from "lucide-react"
import Link from "next/link"

export function JoinCommunityBanner() {
  return (
    <Card className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white border-0 shadow-xl">
      <CardContent className="p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex items-center gap-2">
            <Heart className="h-8 w-8 text-white animate-pulse" />
            <Users className="h-8 w-8 text-white" />
            <Sparkles className="h-8 w-8 text-white animate-pulse" />
          </div>
        </div>
        <h3 className="text-2xl font-bold mb-4">Your Pet Has a Story to Tell</h3>
        <p className="text-pink-100 mb-6 max-w-2xl mx-auto">Upload a video from your phone and hear what they'd say.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" variant="secondary" className="bg-white text-purple-600 hover:bg-gray-100" asChild>
            <Link href="/auth/signup">
              <Sparkles className="h-5 w-5 mr-2" />
              Try It Free
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white text-white hover:bg-white hover:text-purple-600 bg-transparent"
            asChild
          >
            <Link href="/auth/login">Already a Member?</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
