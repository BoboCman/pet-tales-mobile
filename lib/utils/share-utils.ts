"use client"

export interface ShareResult {
  success: boolean
  message: string
}

export async function sharePublicEntry(entryId: string, title: string): Promise<ShareResult> {
  try {
    const shareUrl = `${window.location.origin}/community/public/${entryId}`

    // Check if Web Share API is available
    if (navigator.share && navigator.canShare) {
      const shareData = {
        title: `Pet Tale: ${title}`,
        text: `Check out this adorable pet story!`,
        url: shareUrl,
      }

      if (navigator.canShare(shareData)) {
        await navigator.share(shareData)
        return { success: true, message: "Shared successfully!" }
      }
    }

    // Fallback: copy to clipboard
    await navigator.clipboard.writeText(shareUrl)
    return { success: true, message: "Link copied to clipboard!" }
  } catch (error) {
    console.error("Share error:", error)

    // Final fallback: try to copy manually
    try {
      const shareUrl = `${window.location.origin}/community/public/${entryId}`
      await navigator.clipboard.writeText(shareUrl)
      return { success: true, message: "Link copied to clipboard!" }
    } catch (clipboardError) {
      return { success: false, message: "Unable to share. Please copy the URL manually." }
    }
  }
}
