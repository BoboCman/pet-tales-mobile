"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Video, CreditCard, TrendingUp, Eye, Heart, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface DashboardMetrics {
  users: {
    total: number
    newToday: number
    newThisWeek: number
    growthPercentage: number
  }
  videos: {
    total: number
    createdToday: number
    createdThisWeek: number
  }
  credits: {
    distributed: number
    used: number
    remaining: number
  }
  engagement: {
    totalViews: number
    totalLikes: number
    avgViewsPerVideo: number
  }
  timestamp: string
}

export default function DashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/dashboard/metrics", {
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to fetch metrics")
      }

      const result = await response.json()
      if (result.success) {
        setMetrics(result.data)
      } else {
        throw new Error(result.error || "Failed to fetch metrics")
      }
    } catch (error) {
      console.error("Error fetching metrics:", error)
      toast({
        title: "Error",
        description: "Failed to load dashboard metrics",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-32"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Failed to load metrics</p>
        <Button onClick={fetchMetrics} className="mt-4">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-gray-500">Last updated: {new Date(metrics.timestamp).toLocaleString()}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMetrics}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.users.total}</div>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-xs text-gray-500">
                +{metrics.users.newToday} today, +{metrics.users.newThisWeek} this week
              </p>
            </div>
            {metrics.users.growthPercentage > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-green-600" />
                <span className="text-xs text-green-600">+{metrics.users.growthPercentage}% (30d)</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Videos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Videos</CardTitle>
            <Video className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.videos.total}</div>
            <p className="text-xs text-gray-500 mt-2">
              +{metrics.videos.createdToday} today, +{metrics.videos.createdThisWeek} this week
            </p>
          </CardContent>
        </Card>

        {/* Credits */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Credits</CardTitle>
            <CreditCard className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.credits.remaining}</div>
            <p className="text-xs text-gray-500 mt-2">
              {metrics.credits.distributed} distributed, {metrics.credits.used} used
            </p>
          </CardContent>
        </Card>

        {/* Engagement */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Engagement</CardTitle>
            <Eye className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.engagement.totalViews}</div>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {metrics.engagement.avgViewsPerVideo} avg/video
              </span>
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {metrics.engagement.totalLikes} likes
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
