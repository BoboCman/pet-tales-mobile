"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { RefreshCw, Play, Download, AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react"

interface CaptionEntry {
  id: string
  pet_name: string
  title: string
  caption_status: string
  caption_processing_started_at: string | null
  caption_processing_completed_at: string | null
  caption_error: string | null
  caption_files: {
    vtt_url: string | null
    srt_url: string | null
  }
  cloudinary_audio_public_id: string | null
  created_at: string
  caption_transcript?: string
}

interface CaptionStats {
  total: number
  completed: number
  processing: number
  failed: number
  pending: number
}

export default function CaptionDebug() {
  const [entries, setEntries] = useState<CaptionEntry[]>([])
  const [stats, setStats] = useState<CaptionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<CaptionEntry | null>(null)
  const [transcript, setTranscript] = useState<string>("")

  const fetchCaptionStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/captions/status")
      const data = await response.json()

      if (data.success) {
        setEntries(data.entries)
        setStats(data.statistics)
      }
    } catch (error) {
      console.error("Failed to fetch caption status:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEntryDetails = async (entryId: string) => {
    try {
      const response = await fetch(`/api/captions/status?entryId=${entryId}&includeTranscript=true`)
      const data = await response.json()

      if (data.success) {
        setSelectedEntry(data.entry)
        setTranscript(data.entry.caption_transcript || "")
      }
    } catch (error) {
      console.error("Failed to fetch entry details:", error)
    }
  }

  const retryCaption = async (entryId: string) => {
    try {
      setRetryingId(entryId)
      const response = await fetch("/api/captions/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      })

      const data = await response.json()

      if (data.success) {
        // Refresh the list after retry
        await fetchCaptionStatus()
      } else {
        console.error("Caption retry failed:", data.error)
      }
    } catch (error) {
      console.error("Failed to retry caption:", error)
    } finally {
      setRetryingId(null)
    }
  }

  useEffect(() => {
    fetchCaptionStatus()
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        )
      case "processing":
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Processing
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        )
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Caption Generation Debug</h1>
        <Button onClick={fetchCaptionStatus} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.processing}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Entries List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Caption Entries</CardTitle>
            <CardDescription>Recent diary entries with caption generation status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => fetchEntryDetails(entry.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium">{entry.pet_name}</h3>
                      <p className="text-sm text-gray-600 truncate">{entry.title}</p>
                    </div>
                    {getStatusBadge(entry.caption_status)}
                  </div>

                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Created: {formatDate(entry.created_at)}</div>
                    {entry.caption_processing_started_at && (
                      <div>Started: {formatDate(entry.caption_processing_started_at)}</div>
                    )}
                    {entry.caption_processing_completed_at && (
                      <div>Completed: {formatDate(entry.caption_processing_completed_at)}</div>
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-3">
                    <div className="flex space-x-2">
                      {entry.caption_files.vtt_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(entry.caption_files.vtt_url!, "_blank")
                          }}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          VTT
                        </Button>
                      )}
                      {entry.caption_files.srt_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(entry.caption_files.srt_url!, "_blank")
                          }}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          SRT
                        </Button>
                      )}
                    </div>

                    {(entry.caption_status === "failed" || !entry.caption_status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          retryCaption(entry.id)
                        }}
                        disabled={retryingId === entry.id}
                      >
                        {retryingId === entry.id ? (
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3 mr-1" />
                        )}
                        Retry
                      </Button>
                    )}
                  </div>

                  {entry.caption_error && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                      Error: {entry.caption_error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Entry Details */}
        <Card>
          <CardHeader>
            <CardTitle>Entry Details</CardTitle>
            <CardDescription>
              {selectedEntry ? `Details for ${selectedEntry.pet_name}` : "Select an entry to view details"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedEntry ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Basic Information</h3>
                  <div className="text-sm space-y-1">
                    <div>
                      <strong>Pet:</strong> {selectedEntry.pet_name}
                    </div>
                    <div>
                      <strong>Title:</strong> {selectedEntry.title}
                    </div>
                    <div>
                      <strong>Status:</strong> {getStatusBadge(selectedEntry.caption_status)}
                    </div>
                    <div>
                      <strong>Audio ID:</strong> {selectedEntry.cloudinary_audio_public_id || "N/A"}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Processing Timeline</h3>
                  <div className="text-sm space-y-1">
                    <div>
                      <strong>Created:</strong> {formatDate(selectedEntry.created_at)}
                    </div>
                    <div>
                      <strong>Started:</strong> {formatDate(selectedEntry.caption_processing_started_at)}
                    </div>
                    <div>
                      <strong>Completed:</strong> {formatDate(selectedEntry.caption_processing_completed_at)}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Caption Files</h3>
                  <div className="flex space-x-2">
                    {selectedEntry.caption_files.vtt_url ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(selectedEntry.caption_files.vtt_url!, "_blank")}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download VTT
                      </Button>
                    ) : (
                      <Badge variant="outline">No VTT</Badge>
                    )}
                    {selectedEntry.caption_files.srt_url ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(selectedEntry.caption_files.srt_url!, "_blank")}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download SRT
                      </Button>
                    ) : (
                      <Badge variant="outline">No SRT</Badge>
                    )}
                  </div>
                </div>

                {transcript && (
                  <div>
                    <h3 className="font-medium mb-2">Transcript</h3>
                    <Textarea value={transcript} readOnly className="min-h-32" placeholder="No transcript available" />
                  </div>
                )}

                {selectedEntry.caption_error && (
                  <div>
                    <h3 className="font-medium mb-2 text-red-600">Error Details</h3>
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                      {selectedEntry.caption_error}
                    </div>
                  </div>
                )}

                <div className="flex space-x-2">
                  {(selectedEntry.caption_status === "failed" || !selectedEntry.caption_status) && (
                    <Button onClick={() => retryCaption(selectedEntry.id)} disabled={retryingId === selectedEntry.id}>
                      {retryingId === selectedEntry.id ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Retry Caption Generation
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">Click on an entry to view detailed information</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
