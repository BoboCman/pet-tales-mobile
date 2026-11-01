import { NextRequest, NextResponse } from "next/server"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Helper to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// Helper to list all assets in a folder with pagination
async function listAllAssets(
  folder: string,
  resourceType: "video" | "raw"
): Promise<Array<{ public_id: string; bytes: number }>> {
  const allAssets: Array<{ public_id: string; bytes: number }> = []
  let nextCursor: string | undefined = undefined

  do {
    const result = await cloudinary.api.resources({
      type: "upload",
      resource_type: resourceType,
      prefix: folder,
      max_results: 500,
      next_cursor: nextCursor,
    })

    allAssets.push(
      ...result.resources.map((r: any) => ({
        public_id: r.public_id,
        bytes: r.bytes || 0,
      }))
    )

    nextCursor = result.next_cursor
  } while (nextCursor)

  return allAssets
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const secret = searchParams.get("secret")
  const mode = searchParams.get("mode") || "preview"

  // Security check
  const expectedSecret = process.env.CLEANUP_SECRET
  if (!expectedSecret) {
    return NextResponse.json(
      {
        success: false,
        error: "CLEANUP_SECRET environment variable not configured",
        instructions:
          "Add CLEANUP_SECRET to your Vercel environment variables first",
      },
      { status: 500 }
    )
  }

  if (!secret || secret !== expectedSecret) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized - Invalid or missing secret",
        hint: "Add ?secret=YOUR_SECRET to the URL",
      },
      { status: 401 }
    )
  }

  try {
    // Define folders to clean up
    const foldersToClean = [
      { folder: "pawsense/intermediate", resourceType: "video" as const, name: "Intermediate Videos" },
      { folder: "pawsense/audio", resourceType: "video" as const, name: "Audio Files (MP3)" },
      { folder: "pawsense/compressed", resourceType: "video" as const, name: "Compressed Videos" },
      { folder: "pawsense/audio", resourceType: "raw" as const, name: "Caption Files (VTT/SRT)" },
    ]

    const folderBreakdown = []
    let totalAssets = 0
    let totalBytes = 0
    let totalDeleted = 0
    const errors: string[] = []

    // Process each folder
    for (const { folder, resourceType, name } of foldersToClean) {
      console.log(`Scanning ${name}: ${folder} (${resourceType})...`)

      const assets = await listAllAssets(folder, resourceType)
      const folderBytes = assets.reduce((sum, a) => sum + a.bytes, 0)

      totalAssets += assets.length
      totalBytes += folderBytes

      const sampleAssets = assets.slice(0, 3).map((a) => a.public_id)

      // Delete mode: actually delete the assets
      if (mode === "delete" && assets.length > 0) {
        for (const asset of assets) {
          try {
            await cloudinary.uploader.destroy(asset.public_id, {
              resource_type: resourceType,
              invalidate: true,
            })
            totalDeleted++
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            errors.push(`Failed to delete ${asset.public_id}: ${msg}`)
          }
        }
      }

      folderBreakdown.push({
        name,
        folder,
        resourceType,
        assetCount: assets.length,
        size: formatBytes(folderBytes),
        sampleAssets: sampleAssets.length > 0 ? sampleAssets : ["No assets found"],
      })
    }

    const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2)
    const estimatedCredits = Math.floor(totalBytes / (1024 * 1024 * 1024))

    return NextResponse.json({
      success: true,
      mode,
      security: "🔒 Authorized request",
      warning:
        mode === "preview"
          ? "⚠️ PREVIEW MODE - No files were deleted. Add &mode=delete to actually delete."
          : "✅ DELETE MODE - Files have been permanently deleted from Cloudinary.",
      summary: {
        totalAssetsFound: totalAssets,
        totalAssetsDeleted: mode === "delete" ? totalDeleted : 0,
        totalSize: `${totalGB} GB`,
        totalBytes,
        estimatedCreditsSaved: `~${estimatedCredits} credits`,
      },
      folderBreakdown,
      errors: errors.length > 0 ? errors : undefined,
      nextSteps:
        mode === "preview"
          ? [
              "1. Review the folderBreakdown to confirm these are temporary files",
              "2. Verify that no final merged videos are listed (they should be in pawsense/merged/)",
              "3. Run again with &mode=delete to actually delete the files",
              "4. After successful cleanup, delete this API route and remove CLEANUP_SECRET env var",
            ]
          : [
              `Successfully deleted ${totalDeleted} assets, saving ~${totalGB} GB`,
              "Next steps:",
              "1. Delete the app/api/admin/cloudinary-cleanup/ folder from your codebase",
              "2. Remove CLEANUP_SECRET from Vercel environment variables",
              "3. Redeploy to remove this endpoint completely",
              "4. Future videos will auto-cleanup via cleanupTemporaryAssets() function",
            ],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      {
        success: false,
        error: "Cloudinary API error",
        details: msg,
      },
      { status: 500 }
    )
  }
}

// Block all other HTTP methods
export async function POST() {
  return NextResponse.json(
    { error: "Method not allowed - Use GET with ?secret=XXX&mode=preview" },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: "Method not allowed - Use GET with ?secret=XXX&mode=preview" },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Method not allowed - Use GET with ?secret=XXX&mode=preview" },
    { status: 405 }
  )
}
