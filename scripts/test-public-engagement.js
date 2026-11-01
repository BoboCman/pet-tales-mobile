// Test script to verify public engagement functionality
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase environment variables")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testPublicEngagement() {
  console.log("🧪 Testing public engagement functionality...")

  try {
    // 1. Fetch a public tale
    console.log("\n1. Fetching public tales...")
    const { data: tales, error: fetchError } = await supabase
      .from("diary_entries")
      .select("id, title, view_count, like_count, session_views, anonymous_likes")
      .eq("is_public", true)
      .limit(1)

    if (fetchError) {
      console.error("❌ Error fetching tales:", fetchError)
      return
    }

    if (!tales || tales.length === 0) {
      console.log("⚠️ No public tales found")
      return
    }

    const testTale = tales[0]
    console.log("✅ Found test tale:", {
      id: testTale.id,
      title: testTale.title,
      currentViews: testTale.view_count,
      currentLikes: testTale.like_count,
    })

    // 2. Test view recording
    console.log("\n2. Testing view recording...")
    const testSessionId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const currentViewCount = testTale.view_count || 0
    const currentSessionViews = testTale.session_views || []

    // Check if test session already viewed
    if (currentSessionViews.includes(testSessionId)) {
      console.log("⚠️ Test session already viewed this tale")
    } else {
      const newViewCount = currentViewCount + 1
      const newSessionViews = [...currentSessionViews, testSessionId]

      const { error: viewError } = await supabase
        .from("diary_entries")
        .update({
          view_count: newViewCount,
          session_views: newSessionViews,
        })
        .eq("id", testTale.id)
        .eq("is_public", true)

      if (viewError) {
        console.error("❌ Error updating view:", viewError)
      } else {
        console.log("✅ View recorded successfully:", {
          oldCount: currentViewCount,
          newCount: newViewCount,
        })
      }
    }

    // 3. Test like recording
    console.log("\n3. Testing like recording...")
    const currentLikeCount = testTale.like_count || 0
    const currentAnonymousLikes = testTale.anonymous_likes || []

    // Check if test session already liked
    const hasLiked = currentAnonymousLikes.includes(testSessionId)

    let newLikeCount, newAnonymousLikes
    if (hasLiked) {
      newLikeCount = Math.max(0, currentLikeCount - 1)
      newAnonymousLikes = currentAnonymousLikes.filter((id) => id !== testSessionId)
      console.log("👎 Removing test like...")
    } else {
      newLikeCount = currentLikeCount + 1
      newAnonymousLikes = [...currentAnonymousLikes, testSessionId]
      console.log("👍 Adding test like...")
    }

    const { error: likeError } = await supabase
      .from("diary_entries")
      .update({
        like_count: newLikeCount,
        anonymous_likes: newAnonymousLikes,
      })
      .eq("id", testTale.id)
      .eq("is_public", true)

    if (likeError) {
      console.error("❌ Error updating like:", likeError)
    } else {
      console.log("✅ Like recorded successfully:", {
        oldCount: currentLikeCount,
        newCount: newLikeCount,
        action: hasLiked ? "removed" : "added",
      })
    }

    // 4. Verify final state
    console.log("\n4. Verifying final state...")
    const { data: updatedTale, error: verifyError } = await supabase
      .from("diary_entries")
      .select("view_count, like_count, session_views, anonymous_likes")
      .eq("id", testTale.id)
      .single()

    if (verifyError) {
      console.error("❌ Error verifying updates:", verifyError)
    } else {
      console.log("✅ Final state:", {
        viewCount: updatedTale.view_count,
        likeCount: updatedTale.like_count,
        sessionViewsCount: (updatedTale.session_views || []).length,
        anonymousLikesCount: (updatedTale.anonymous_likes || []).length,
      })
    }

    console.log("\n🎉 Test completed successfully!")
  } catch (error) {
    console.error("❌ Test failed:", error)
  }
}

// Run the test
testPublicEngagement()
