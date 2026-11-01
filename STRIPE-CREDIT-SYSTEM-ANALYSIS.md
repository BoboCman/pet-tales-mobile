# COMPREHENSIVE CODEBASE ANALYSIS: Stripe Integration & Credit System

**Analysis Date:** January 2025  
**Purpose:** Complete understanding of current subscription-based system before migration to pack-based model  
**Status:** Test Mode (Stripe test_ prefix)

---

## EXECUTIVE SUMMARY

### Current Architecture Overview

Pet Tales AI currently implements a **subscription-based credit system** with the following characteristics:

- **Payment Provider:** Stripe (test mode)
- **Pricing Model:** Monthly/Annual subscriptions with recurring credits
- **Credit System:** Monthly allowance that resets on the 1st of each month
- **Tiers:** Free (5 credits), Basic (25 credits), Pro (75 credits), Premium (200 credits)
- **Database:** Supabase PostgreSQL with RLS policies
- **Cron Jobs:** Monthly credit reset via pg_cron
- **Webhook Integration:** Stripe webhooks for subscription lifecycle events (NOT YET IMPLEMENTED)

### Key Findings

✅ **What's Complete:**
- Database schema with all Stripe subscription columns
- Credit ledger system with atomic debit/grant operations
- Checkout session creation API
- Pricing page with tier selection
- Settings page with subscription display
- Monthly credit reset infrastructure (pg_cron)

❌ **What's Missing:**
- Stripe webhook handler (critical - subscriptions won't activate without this)
- Stripe Customer Portal integration
- Subscription cancellation flow
- Payment failure handling
- Invoice management

### Complexity Rating

| Subsystem | Complexity | Risk Level | LOC (est) |
|-----------|-----------|------------|-----------|
| Database Schema | **Moderate** | Low | 400 lines |
| Credit Logic | **Complex** | Medium | 600 lines |
| Stripe Integration | **Simple** | Low | 200 lines |
| UI Components | **Simple** | Low | 800 lines |
| Webhook Handler | **NOT IMPLEMENTED** | **HIGH** | 0 lines |
| Cron Jobs | **Moderate** | Medium | 300 lines |

**Overall Migration Complexity:** **MODERATE-HIGH**  
**Estimated Effort:** 20-30 hours of development + testing

---

## SECTION 1: DATABASE SCHEMA & CREDIT SYSTEM

### 1.1 Users Table - Credit & Subscription Columns

**File:** `scripts/20241224000000_stripe_subscription_schema.sql`

```sql
-- Credit tracking
credits_remaining integer NOT NULL DEFAULT 0

-- Subscription tracking
subscription_tier text DEFAULT 'free'
subscription_status text DEFAULT 'active'
monthly_credit_allowance integer NOT NULL DEFAULT 5

-- Stripe integration
stripe_customer_id text
stripe_subscription_id text UNIQUE
stripe_price_id text

-- Billing period
subscription_period_start timestamptz
subscription_period_end timestamptz
subscription_cancel_at_period_end boolean DEFAULT false

-- Credit reset tracking
credit_reset_date timestamptz
```

**Column Details:**

| Column | Type | Default | Nullable | Purpose |
|--------|------|---------|----------|---------|
| `credits_remaining` | integer | 0 | NO | Current available credits |
| `subscription_tier` | text | 'free' | YES | free/basic/pro/premium |
| `subscription_status` | text | 'active' | YES | active/canceled/past_due |
| `monthly_credit_allowance` | integer | 5 | NO | Credits granted per month |
| `stripe_customer_id` | text | NULL | YES | Stripe customer ID (cus_xxx) |
| `stripe_subscription_id` | text | NULL | YES | Active subscription ID (sub_xxx) |
| `stripe_price_id` | text | NULL | YES | Current price ID |
| `subscription_period_start` | timestamptz | NULL | YES | Billing period start |
| `subscription_period_end` | timestamptz | NULL | YES | Billing period end |
| `subscription_cancel_at_period_end` | boolean | false | YES | Cancellation flag |
| `credit_reset_date` | timestamptz | NULL | YES | Last credit reset timestamp |

**Indexes:**
```sql
CREATE INDEX idx_users_stripe_subscription_id ON users (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX idx_users_credit_reset_date ON users (credit_reset_date) WHERE credit_reset_date IS NOT NULL;
```

### 1.2 Credit Ledger Table

**File:** `scripts/phase-3a-credits-ledger-v3.sql`

```sql
CREATE TABLE credit_ledger (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta integer NOT NULL,  -- Positive for grants, negative for debits
    reason text NOT NULL CHECK (reason IN (
        'welcome_bonus', 
        'daily_faucet', 
        'manual_topup', 
        'debit_for_entry', 
        'admin_adjustment', 
        'referral_bonus',
        'subscription_renewal',  -- Added for Stripe
        'monthly_reset'          -- Added for Stripe
    )),
    entry_id uuid REFERENCES diary_entries(id) ON DELETE SET NULL,
    metadata jsonb,
    created_at timestamptz DEFAULT now()
);
```

**Purpose:** Immutable audit trail of all credit transactions

**Allowed Reasons:**
- `welcome_bonus` - 5 credits on signup
- `subscription_renewal` - Credits granted when subscription renews
- `monthly_reset` - Credits granted by cron job on 1st of month
- `debit_for_entry` - 1 credit deducted per video (based on duration)
- `manual_topup` - Admin-granted credits
- `admin_adjustment` - Admin corrections
- `referral_bonus` - Future feature
- `daily_faucet` - Future feature

### 1.3 Stripe Webhook Events Table

**File:** `scripts/20241224000000_stripe_subscription_schema.sql`

```sql
CREATE TABLE stripe_webhook_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id text NOT NULL UNIQUE,  -- Idempotency key
    event_type text NOT NULL,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    processed_at timestamptz NOT NULL DEFAULT now(),
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'skipped'))
);
```

**Purpose:** Prevent duplicate webhook processing via UNIQUE constraint on `event_id`

**Indexes:**
```sql
CREATE INDEX idx_stripe_webhook_events_event_id ON stripe_webhook_events (event_id);
CREATE INDEX idx_stripe_webhook_events_user_id ON stripe_webhook_events (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_stripe_webhook_events_event_type ON stripe_webhook_events (event_type);
CREATE INDEX idx_stripe_webhook_events_processed_at ON stripe_webhook_events (processed_at DESC);
```

### 1.4 Database Functions

#### grant_credits()

**File:** `scripts/20241224000000_stripe_subscription_schema.sql`

```sql
CREATE OR REPLACE FUNCTION grant_credits(
    amount integer,
    reason text,
    entry_id uuid DEFAULT NULL,
    metadata jsonb DEFAULT NULL,
    target_user uuid DEFAULT NULL
) RETURNS integer
```

**Logic:**
1. Validates amount > 0
2. Validates reason is in allowed list
3. Inserts positive delta into credit_ledger
4. Updates users.credits_remaining atomically
5. Returns new balance

**Security:** SECURITY DEFINER, only service_role can execute

#### debit_credits_for_entry()

**File:** `scripts/phase-3a-credits-ledger-v3.sql`

```sql
CREATE OR REPLACE FUNCTION debit_credits_for_entry(
    entry_id uuid,
    video_duration_seconds integer
) RETURNS jsonb
```

**Logic:**
1. Calculates credits needed (1 per 60 seconds, minimum 1)
2. Checks if entry already debited (idempotency)
3. Verifies user has sufficient credits
4. Atomically deducts credits and marks entry as debited
5. Returns success/failure status

**Idempotency:** Uses `diary_entries.credits_debited` boolean flag

#### get_subscription_info()

**File:** `scripts/20241224000000_stripe_subscription_schema.sql`

```sql
CREATE OR REPLACE FUNCTION get_subscription_info(
    target_user uuid DEFAULT auth.uid()
) RETURNS TABLE (...)
```

**Purpose:** Helper function to fetch complete subscription details for a user

**Security:** Users can only query their own info, service_role can query any user

### 1.5 Database Triggers

#### handle_new_user()

**File:** `scripts/phase-1a-auth-foundation.sql`

```sql
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

**Logic:**
1. Automatically creates `public.users` row when auth user is created
2. Sets default values: subscription_tier='free', credits_remaining=0
3. Copies email, name, avatar from auth.users

#### Welcome Bonus Trigger

**File:** `scripts/001_welcome_bonus_setup.sql`

```sql
CREATE TRIGGER grant_welcome_bonus_trigger
    AFTER INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION grant_welcome_bonus();
```

**Logic:**
1. Grants 5 welcome credits to new users
2. Creates credit_ledger entry with reason='welcome_bonus'
3. Updates users.credits_remaining

### 1.6 Current Credit Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    CREDIT LIFECYCLE                          │
└─────────────────────────────────────────────────────────────┘

1. USER SIGNUP
   ↓
   auth.users INSERT
   ↓
   handle_new_user() trigger
   ↓
   public.users INSERT (credits_remaining=0)
   ↓
   grant_welcome_bonus() trigger
   ↓
   grant_credits(5, 'welcome_bonus')
   ↓
   users.credits_remaining = 5

2. MONTHLY RESET (1st of month, 00:05 UTC)
   ↓
   pg_cron job: reset_monthly_credits()
   ↓
   FOR EACH user WHERE credit_reset_date < now()
   ↓
   grant_credits(monthly_credit_allowance, 'monthly_reset')
   ↓
   users.credits_remaining += monthly_credit_allowance
   ↓
   users.credit_reset_date = now()

3. VIDEO CREATION
   ↓
   User clicks "Create Video"
   ↓
   preflightBalanceCheck() - checks credits_remaining >= 1
   ↓
   IF insufficient: show OutOfCreditsModal
   ↓
   IF sufficient: allow upload
   ↓
   Video uploaded to Cloudinary
   ↓
   Cloudinary webhook fires
   ↓
   debit_credits_for_entry(entry_id, video_duration)
   ↓
   users.credits_remaining -= credits_needed
   ↓
   credit_ledger INSERT (delta=-credits_needed, reason='debit_for_entry')

4. SUBSCRIPTION PURCHASE (NOT YET IMPLEMENTED)
   ↓
   User clicks "Subscribe" on pricing page
   ↓
   /api/stripe/create-checkout-session
   ↓
   Stripe Checkout
   ↓
   Stripe webhook: customer.subscription.created
   ↓
   [WEBHOOK HANDLER MISSING]
   ↓
   Should update:
   - users.stripe_subscription_id
   - users.stripe_price_id
   - users.subscription_tier
   - users.subscription_status
   - users.monthly_credit_allowance
   - users.subscription_period_start/end
   ↓
   Should grant credits:
   - grant_credits(monthly_allowance, 'subscription_renewal')
```

---

## SECTION 2: STRIPE INTEGRATION - API ROUTES

### 2.1 Checkout Session Creation

**File:** `app/api/stripe/create-checkout-session/route.ts`

**Endpoint:** `POST /api/stripe/create-checkout-session`

**Input:**
```typescript
{
  priceId: string  // e.g., "price_test_basic_monthly"
}
```

**Logic:**
1. Authenticates user via Supabase
2. Validates priceId against allowed price IDs
3. Fetches user data (email, stripe_customer_id)
4. Creates or retrieves Stripe customer
5. Saves stripe_customer_id to database
6. Creates Stripe checkout session with:
   - mode: "subscription"
   - customer: stripe_customer_id
   - line_items: [{ price: priceId, quantity: 1 }]
   - success_url: /dashboard/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}&success=true
   - cancel_url: /pricing?canceled=true
7. Returns session URL for redirect

**Output:**
```typescript
{
  sessionId: string,
  url: string  // Stripe Checkout URL
}
```

**Metadata Passed to Stripe:**
```typescript
{
  userId: user.id,
  userEmail: user.email
}
```

**Error Handling:**
- 401: Not authenticated
- 400: Invalid price ID
- 404: User not found
- 500: Stripe API error

**Code Snippet:**
```typescript
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  mode: "subscription",
  payment_method_types: ["card"],
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}&success=true`,
  cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
  metadata: {
    userId: user.id,
    userEmail: userData.email,
  },
  subscription_data: {
    metadata: {
      userId: user.id,
    },
  },
})
```

### 2.2 Webhook Handler

**Status:** ❌ **NOT IMPLEMENTED**

**Expected File:** `app/api/stripe/webhook/route.ts` or `app/api/webhooks/stripe/route.ts`

**Expected Endpoint:** `POST /api/stripe/webhook`

**Expected Events to Handle:**

1. **customer.subscription.created**
   - Extract subscription object
   - Get userId from metadata
   - Update users table:
     - stripe_subscription_id
     - stripe_price_id
     - subscription_tier (map from price_id)
     - subscription_status = 'active'
     - monthly_credit_allowance (based on tier)
     - subscription_period_start
     - subscription_period_end
   - Grant initial credits: `grant_credits(monthly_allowance, 'subscription_renewal')`
   - Insert into stripe_webhook_events for idempotency

2. **customer.subscription.updated**
   - Handle plan changes (upgrade/downgrade)
   - Update subscription_tier, monthly_credit_allowance
   - Handle cancellation: subscription_cancel_at_period_end = true

3. **customer.subscription.deleted**
   - Set subscription_status = 'canceled'
   - Set subscription_tier = 'free'
   - Set monthly_credit_allowance = 5
   - Clear stripe_subscription_id, stripe_price_id

4. **invoice.payment_succeeded**
   - Grant monthly credits on renewal
   - `grant_credits(monthly_allowance, 'subscription_renewal')`
   - Update subscription_period_start/end

5. **invoice.payment_failed**
   - Set subscription_status = 'past_due'
   - Send notification to user

**Expected Signature Verification:**
```typescript
const sig = request.headers.get("stripe-signature")
const event = stripe.webhooks.constructEvent(
  body,
  sig,
  process.env.STRIPE_WEBHOOK_SECRET
)
```

**Expected Idempotency Check:**
```typescript
const { data: existing } = await supabase
  .from("stripe_webhook_events")
  .select("id")
  .eq("event_id", event.id)
  .single()

if (existing) {
  return NextResponse.json({ received: true, skipped: "duplicate" })
}
```

### 2.3 Other Stripe Routes

**Status:** ❌ **NOT IMPLEMENTED**

**Expected Routes:**
- `POST /api/stripe/create-portal-session` - Stripe Customer Portal for subscription management
- `GET /api/stripe/subscription-status` - Fetch current subscription status
- `POST /api/stripe/cancel-subscription` - Cancel subscription

---

## SECTION 3: STRIPE CONFIGURATION

### 3.1 Stripe Client Configuration

**File:** `lib/stripe.ts`

```typescript
import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment variables")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
  appInfo: {
    name: "Pet Tales AI",
    version: "1.0.0",
  },
})
```

**API Version:** `2024-12-18.acacia` (latest as of Dec 2024)

**Configuration:**
- TypeScript support enabled
- App info for Stripe dashboard identification

### 3.2 Pricing Configuration

**File:** `lib/pricing-config.ts`

**Pricing Tiers:**

| Tier | Monthly Price | Annual Price | Credits/Month | Stripe Price IDs |
|------|--------------|--------------|---------------|------------------|
| Basic | $9 | $90 (save $18) | 25 | STRIPE_BASIC_MONTHLY_PRICE_ID<br>STRIPE_BASIC_ANNUAL_PRICE_ID |
| Pro | $19 | $190 (save $38) | 75 | STRIPE_PRO_MONTHLY_PRICE_ID<br>STRIPE_PRO_ANNUAL_PRICE_ID |
| Premium | $49 | $490 (save $98) | 200 | STRIPE_PREMIUM_MONTHLY_PRICE_ID<br>STRIPE_PREMIUM_ANNUAL_PRICE_ID |

**Features by Tier:**

**Basic:**
- 25 videos per month
- Standard processing
- HD video quality
- Email support
- All personality voices

**Pro (Popular):**
- 75 videos per month
- Priority processing
- HD video quality
- Priority email support
- All personality voices
- Custom voices (coming soon)

**Premium:**
- 200 videos per month
- Priority processing
- 4K video quality
- Priority support
- All personality voices
- Custom voices
- API access (coming soon)
- White-label option (coming soon)

**Implementation Note:**
Uses JavaScript getter functions for lazy evaluation of environment variables:

```typescript
get stripePriceIds() {
  return {
    monthly: getRequiredEnvVar("STRIPE_BASIC_MONTHLY_PRICE_ID"),
    annual: getRequiredEnvVar("STRIPE_BASIC_ANNUAL_PRICE_ID"),
  }
}
```

This prevents "Missing required environment variable" errors at module load time.

### 3.3 Environment Variables

**Required Stripe Variables:**

```env
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (Test Mode)
STRIPE_BASIC_MONTHLY_PRICE_ID=price_test_...
STRIPE_BASIC_ANNUAL_PRICE_ID=price_test_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_test_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_test_...
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_test_...
STRIPE_PREMIUM_ANNUAL_PRICE_ID=price_test_...

# App URL (for Stripe redirects)
NEXT_PUBLIC_APP_URL=https://www.pettales-ai.com
```

**Where Used:**
- `STRIPE_SECRET_KEY` - lib/stripe.ts, all API routes
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Client-side Stripe.js (not currently used)
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification
- `STRIPE_*_PRICE_ID` - Pricing config, checkout session creation
- `NEXT_PUBLIC_APP_URL` - Success/cancel URLs in checkout

### 3.4 Error Handling

**File:** `lib/stripe-errors.ts`

```typescript
export function formatStripeError(error: unknown): string {
  if (error instanceof Stripe.errors.StripeError) {
    switch (error.type) {
      case "StripeCardError":
        return `Card error: ${error.message}`
      case "StripeRateLimitError":
        return "Too many requests. Please try again later."
      case "StripeInvalidRequestError":
        return "Invalid request. Please check your input."
      case "StripeAPIError":
        return "Stripe API error. Please try again."
      case "StripeConnectionError":
        return "Network error. Please check your connection."
      case "StripeAuthenticationError":
        return "Authentication error. Please contact support."
      default:
        return error.message || "An unexpected error occurred."
    }
  }
  return "An unexpected error occurred."
}
```

**Error Types Handled:**
- Card errors (declined, expired, incorrect CVC)
- Rate limiting
- Invalid requests
- API errors
- Network errors
- Authentication errors

---

## SECTION 4: CREDIT BUSINESS LOGIC

### 4.1 Credit Deduction

**File:** `app/actions/credit-actions.ts`

**Function:** `preflightBalanceCheck()`

**Purpose:** Check if user has sufficient credits BEFORE allowing video upload

**Logic:**
```typescript
export async function preflightBalanceCheck(): Promise<PreflightCheckResult> {
  // 1. Get authenticated user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { balance: 0, outcome: "blocked", message: "Authentication required" }
  }
  
  // 2. Fetch credit balance via RPC
  const { data: balance } = await supabase.rpc("get_credit_balance")
  
  // 3. Fallback to direct query if RPC fails
  if (!balance) {
    const { data: userData } = await supabase
      .from("users")
      .select("credits_remaining")
      .eq("id", user.id)
      .single()
    
    const userBalance = userData.credits_remaining ?? 0
    
    if (userBalance < 1) {
      return { 
        balance: userBalance, 
        outcome: "blocked", 
        code: "OUT_OF_CREDITS",
        message: "You don't have enough credits" 
      }
    }
    
    return { balance: userBalance, outcome: "allowed" }
  }
  
  // 4. Return result
  return { balance, outcome: balance >= 1 ? "allowed" : "blocked" }
}
```

**Called From:**
- `components/reels/video-upload-interface.tsx` - Before showing upload UI
- `app/dashboard/reels/new/page.tsx` - On page load

**Actual Deduction:**

**File:** `app/api/cloudinary/webhook/route.ts`

**Trigger:** Cloudinary webhook after video compression completes

**Logic:**
```typescript
// 1. Cloudinary sends webhook with video metadata
const { public_id, duration } = webhookPayload

// 2. Find diary_entry by cloudinary_public_id
const { data: entry } = await supabase
  .from("diary_entries")
  .select("id, user_id, credits_debited")
  .eq("cloudinary_public_id", public_id)
  .single()

// 3. Call debit_credits_for_entry RPC
const { data: result } = await supabase.rpc("debit_credits_for_entry", {
  entry_id: entry.id,
  video_duration_seconds: Math.ceil(duration)
})

// 4. Handle result
if (result.status === "success") {
  console.log(`Debited ${result.credits_debited} credits`)
} else if (result.status === "insufficient_credits") {
  // Mark entry as billing_required
  await supabase
    .from("diary_entries")
    .update({ billing_status: "billing_required" })
    .eq("id", entry.id)
}
```

**Credit Calculation:**
```typescript
// In debit_credits_for_entry() function
credits_to_debit := GREATEST(1, CEIL(video_duration_seconds::numeric / 60.0))

-- Examples:
-- 30 seconds → 1 credit
-- 60 seconds → 1 credit
-- 90 seconds → 2 credits
-- 120 seconds → 2 credits
```

### 4.2 Credit Display

**File:** `hooks/use-credits.ts`

**Hook:** `useCredits()`

**Purpose:** Fetch and cache credit balance for display

**Logic:**
```typescript
export function useCredits() {
  const [credits, setCredits] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function fetchCredits() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setCredits(0)
        setLoading(false)
        return
      }
      
      const { data } = await supabase
        .from("users")
        .select("credits_remaining")
        .eq("id", user.id)
        .single()
      
      setCredits(data?.credits_remaining ?? 0)
      setLoading(false)
    }
    
    fetchCredits()
  }, [])
  
  return { credits, loading, refetch: fetchCredits }
}
```

**Used In:**
- `components/ui/credits-badge.tsx` - Header badge
- `components/ui/out-of-credits-banner.tsx` - Warning banner
- `components/settings/subscription-card.tsx` - Settings page

**Refresh Strategy:**
- Fetched on component mount
- Manual refetch via `refetch()` function
- No automatic polling (could lead to stale data)

### 4.3 Credit Grants

**Monthly Reset Cron Job:**

**File:** `scripts/20241224000001_monthly_credit_reset_cron.sql`

**Schedule:** 1st of every month at 00:05 UTC

```sql
SELECT cron.schedule(
  'monthly-credit-reset',
  '5 0 1 * *',  -- At 00:05 on day 1 of every month
  $$
  SELECT reset_monthly_credits();
  $$
);
```

**Function:** `reset_monthly_credits()`

**Logic:**
```sql
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS TABLE (
    user_id uuid,
    credits_granted integer,
    new_balance integer,
    status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
    result_user_id uuid;
    result_credits_granted integer;
    result_new_balance integer;
    result_status text;
BEGIN
    -- Find all users who need credit reset
    FOR user_record IN
        SELECT 
            u.id,
            u.monthly_credit_allowance,
            u.credits_remaining,
            u.credit_reset_date,
            u.subscription_tier
        FROM users u
        WHERE 
            -- Reset if credit_reset_date is NULL or older than 25 days
            (u.credit_reset_date IS NULL OR u.credit_reset_date < (now() - interval '25 days'))
            -- Only reset for active subscriptions
            AND u.subscription_status = 'active'
    LOOP
        BEGIN
            -- Grant credits using existing grant_credits function
            SELECT grant_credits(
                user_record.monthly_credit_allowance,
                'monthly_reset',
                NULL,
                jsonb_build_object(
                    'previous_balance', user_record.credits_remaining,
                    'tier', user_record.subscription_tier,
                    'reset_date', now()
                ),
                user_record.id
            ) INTO result_new_balance;
            
            -- Update credit_reset_date
            UPDATE users
            SET credit_reset_date = now()
            WHERE id = user_record.id;
            
            -- Return success
            result_user_id := user_record.id;
            result_credits_granted := user_record.monthly_credit_allowance;
            result_status := 'success';
            
            RETURN NEXT;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error and continue
            result_user_id := user_record.id;
            result_credits_granted := 0;
            result_new_balance := user_record.credits_remaining;
            result_status := 'error: ' || SQLERRM;
            
            RETURN NEXT;
        END;
    END LOOP;
END;
$$;
```

**Grace Period Logic:**
- Resets credits if `credit_reset_date` is NULL or older than 25 days
- Allows 5-day grace period for users who might have unused credits
- Only resets for users with `subscription_status = 'active'`

**Subscription Renewal Credits:**

**Expected Logic (NOT YET IMPLEMENTED):**

When Stripe webhook `invoice.payment_succeeded` fires:
```typescript
// In webhook handler
const subscription = event.data.object.subscription
const userId = subscription.metadata.userId
const tier = mapPriceIdToTier(subscription.items.data[0].price.id)
const monthlyAllowance = getMonthlyAllowance(tier)

// Grant credits
await supabase.rpc("grant_credits", {
  amount: monthlyAllowance,
  reason: "subscription_renewal",
  entry_id: null,
  metadata: {
    subscription_id: subscription.id,
    tier: tier,
    billing_period_start: subscription.current_period_start,
    billing_period_end: subscription.current_period_end
  },
  target_user: userId
})
```

### 4.4 Video Creation Integration

**Complete Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│         VIDEO CREATION → CREDIT DEDUCTION FLOW               │
└─────────────────────────────────────────────────────────────┘

1. USER CLICKS "CREATE VIDEO" BUTTON
   ↓
   File: app/dashboard/reels/new/page.tsx
   ↓
   Renders: <VideoUploadInterface />

2. COMPONENT MOUNTS
   ↓
   File: components/reels/video-upload-interface.tsx
   ↓
   useEffect(() => {
     preflightBalanceCheck()
   }, [])

3. PREFLIGHT CHECK
   ↓
   File: app/actions/credit-actions.ts
   ↓
   preflightBalanceCheck()
   ↓
   Query: SELECT credits_remaining FROM users WHERE id = auth.uid()
   ↓
   IF credits_remaining < 1:
     - Show <OutOfCreditsModal />
     - Block upload
   ELSE:
     - Allow upload
     - Show upload UI

4. USER UPLOADS VIDEO
   ↓
   File: components/reels/video-upload-interface.tsx
   ↓
   handleUpload()
   ↓
   POST /api/n8n-direct
   ↓
   Creates diary_entry with status="pending"

5. VIDEO COMPRESSION
   ↓
   File: app/api/video/compress/route.ts
   ↓
   Uploads to Cloudinary with transformation:
   - width: 480
   - quality: auto:eco
   - format: mp4
   ↓
   Cloudinary processes video asynchronously

6. CLOUDINARY WEBHOOK
   ↓
   File: app/api/cloudinary/webhook/route.ts
   ↓
   Receives: { public_id, duration, status: "success" }
   ↓
   Finds diary_entry by cloudinary_public_id
   ↓
   Calls: debit_credits_for_entry(entry_id, duration)

7. CREDIT DEDUCTION
   ↓
   File: scripts/phase-3a-credits-ledger-v3.sql
   ↓
   Function: debit_credits_for_entry()
   ↓
   Logic:
   - Check if already debited (idempotency)
   - Calculate credits: CEIL(duration / 60)
   - Check if user has sufficient credits
   - Atomically:
     - UPDATE users SET credits_remaining -= credits_needed
     - UPDATE diary_entries SET credits_debited = true
     - INSERT INTO credit_ledger (delta=-credits_needed)
   ↓
   Returns: { status: "success", credits_debited: N, new_balance: M }

8. HANDLE INSUFFICIENT CREDITS
   ↓
   IF status = "insufficient_credits":
     - UPDATE diary_entries SET billing_status = "billing_required"
     - Entry marked for manual review
     - User notified (future feature)

9. CONTINUE PROCESSING
   ↓
   TTS generation → Merged video → Final output
   ↓
   User sees completed video in dashboard
```

**Key Files:**
1. `app/dashboard/reels/new/page.tsx` - Entry point
2. `components/reels/video-upload-interface.tsx` - Upload UI
3. `app/actions/credit-actions.ts` - Preflight check
4. `app/api/n8n-direct/route.ts` - Entry creation
5. `app/api/video/compress/route.ts` - Cloudinary upload
6. `app/api/cloudinary/webhook/route.ts` - Webhook handler
7. `scripts/phase-3a-credits-ledger-v3.sql` - Debit function

---

## SECTION 5: UI COMPONENTS - CREDIT & BILLING

### 5.1 Credit Display Components

#### Credits Badge

**File:** `components/ui/credits-badge.tsx`

**Location:** Top header (desktop and mobile)

**Features:**
- Displays current credit balance
- Sparkles icon
- Clickable → links to `/dashboard/settings?tab=billing`
- Color-coded:
  - Green: credits > 5
  - Orange: credits 1-5
  - Red: credits = 0

**Code:**
```typescript
<Link href="/dashboard/settings?tab=billing">
  <Badge variant="outline" className="flex items-center gap-1.5">
    <Sparkles className="h-3.5 w-3.5" />
    <span className="font-semibold">{credits}</span>
    <span className="text-xs text-muted-foreground">credits</span>
  </Badge>
</Link>
```

#### Out of Credits Banner

**File:** `components/ui/out-of-credits-banner.tsx`

**Location:** Dashboard pages when credits = 0

**Features:**
- Alert banner with warning icon
- "You're out of credits" message
- "Upgrade Now" CTA button → `/pricing`
- Shows next reset date (if free tier)

**Code:**
```typescript
{credits === 0 && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>You're out of credits</AlertTitle>
    <AlertDescription>
      Upgrade to keep creating amazing Pet Tales.
      <Button asChild variant="outline" size="sm" className="ml-2 bg-transparent">
        <Link href="/pricing">Upgrade Now</Link>
      </Button>
    </AlertDescription>
  </Alert>
)}
```

#### Out of Credits Modal

**File:** `components/modals/out-of-credits-modal.tsx`

**Trigger:** When user tries to upload with 0 credits

**Features:**
- Dialog modal
- Shows current plan
- Shows next reset date
- "Upgrade to Pro" CTA
- "Maybe Later" dismiss button

**Code:**
```typescript
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Out of Credits</DialogTitle>
      <DialogDescription>
        You've used all your credits for this month.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
      <p>Current plan: <Badge>{tier}</Badge></p>
      <p>Credits reset on: {resetDate}</p>
      <Button asChild className="w-full">
        <Link href="/pricing">Upgrade to Pro</Link>
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

### 5.2 Pricing Page

**File:** `app/pricing/page.tsx` (server component)  
**File:** `app/pricing/pricing-client.tsx` (client component)

**URL:** `/pricing`

**Features:**
- 3 pricing tiers (Basic, Pro, Premium)
- Monthly/Annual toggle
- Annual savings badge
- Feature comparison
- "Subscribe" buttons
- Mobile-responsive grid

**Flow:**
1. Server component fetches pricing data from `pricingTiers`
2. Serializes data (including Stripe price IDs)
3. Passes to client component
4. Client component handles:
   - Billing interval toggle
   - Checkout button clicks
   - Loading states
   - Error handling

**Checkout Logic:**
```typescript
async function handleCheckout(priceId: string, tierName: string) {
  setLoading(priceId)
  
  try {
    // 1. Check authentication
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push(`/auth/login?redirectTo=/pricing`)
      return
    }
    
    // 2. Create checkout session
    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    })
    
    if (!response.ok) {
      throw new Error("Failed to create checkout session")
    }
    
    const { url } = await response.json()
    
    // 3. Redirect to Stripe Checkout
    window.location.href = url
    
  } catch (error) {
    toast({
      title: "Error",
      description: "Failed to start checkout. Please try again.",
      variant: "destructive",
    })
  } finally {
    setLoading(null)
  }
}
```

### 5.3 Settings/Billing Page

**File:** `app/dashboard/settings/page.tsx`

**URL:** `/dashboard/settings?tab=billing`

**Features:**
- Tabbed interface (Profile, Billing, Cookies, Notifications)
- Subscription card component
- Success message after checkout
- Credit balance display
- Plan management

**Subscription Card:**

**File:** `components/settings/subscription-card.tsx`

**Features:**
- Current plan badge (Free/Basic/Pro/Premium)
- Subscription status (Active/Canceled/Past Due)
- Renewal date
- Credit balance with progress bar
- "Upgrade to Pro" button (if free)
- "Change Plan" button (if paid)
- "Manage Billing" button (disabled - coming soon)

**Success Handling:**
```typescript
useEffect(() => {
  const sessionId = searchParams.get("session_id")
  const success = searchParams.get("success")
  
  if (success === "true" && sessionId) {
    toast({
      title: `🎉 Welcome to Pet Tales AI ${tierName}!`,
      description: `Your subscription is now active. You've received ${monthlyAllowance} credits.`,
      duration: 8000,
    })
    
    // Clear query params
    window.history.replaceState({}, "", "/dashboard/settings?tab=billing")
  }
}, [])
```

### 5.4 Checkout Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CHECKOUT FLOW                             │
└─────────────────────────────────────────────────────────────┘

1. USER VISITS PRICING PAGE
   ↓
   URL: /pricing
   ↓
   File: app/pricing/page.tsx (server)
   ↓
   Fetches: pricingTiers from lib/pricing-config.ts
   ↓
   Serializes: tier data + Stripe price IDs
   ↓
   Renders: <PricingClient tiers={tiersData} />

2. USER SELECTS PLAN
   ↓
   File: app/pricing/pricing-client.tsx
   ↓
   User toggles: Monthly ↔ Annual
   ↓
   User clicks: "Subscribe" button
   ↓
   Calls: handleCheckout(priceId, tierName)

3. AUTHENTICATION CHECK
   ↓
   const { data: { user } } = await supabase.auth.getUser()
   ↓
   IF !user:
     - Redirect to /auth/login?redirectTo=/pricing
     - After login, return to pricing page
   ELSE:
     - Continue to checkout

4. CREATE CHECKOUT SESSION
   ↓
   POST /api/stripe/create-checkout-session
   ↓
   Body: { priceId: "price_test_basic_monthly" }
   ↓
   File: app/api/stripe/create-checkout-session/route.ts
   ↓
   Logic:
   - Validate priceId
   - Fetch user data
   - Create/retrieve Stripe customer
   - Save stripe_customer_id to database
   - Create Stripe checkout session
   ↓
   Returns: { sessionId, url }

5. REDIRECT TO STRIPE
   ↓
   window.location.href = url
   ↓
   User sees Stripe Checkout page
   ↓
   User enters payment details
   ↓
   User clicks "Subscribe"

6. STRIPE PROCESSES PAYMENT
   ↓
   Stripe creates subscription
   ↓
   Stripe redirects to success_url:
   /dashboard/settings?tab=billing&session_id=cs_test_xxx&success=true

7. SUCCESS PAGE
   ↓
   File: app/dashboard/settings/page.tsx
   ↓
   Detects: session_id + success=true in URL
   ↓
   Fetches: subscription data from database
   ↓
   Shows: Success toast
   ↓
   Displays: Updated subscription card

8. WEBHOOK PROCESSING (NOT YET IMPLEMENTED)
   ↓
   Stripe sends webhook: customer.subscription.created
   ↓
   [WEBHOOK HANDLER MISSING]
   ↓
   Should update database:
   - stripe_subscription_id
   - stripe_price_id
   - subscription_tier
   - subscription_status
   - monthly_credit_allowance
   - subscription_period_start/end
   ↓
   Should grant credits:
   - grant_credits(monthly_allowance, 'subscription_renewal')
```

**Current Issue:**
- Webhook handler is missing, so subscription data is NOT updated in database
- User sees success message but subscription is not activated
- Credits are not granted
- User cannot create videos

### 5.5 Credit Warning/Upgrade Prompts

**Locations:**

1. **Last Credit Warning Toast**
   - **File:** `components/reels/video-upload-interface.tsx`
   - **Trigger:** After successful upload when user has 2 credits before upload (1 after)
   - **Message:** "Last credit! ⚠️ Upgrade to keep creating amazing Pet Tales."
   - **Action:** "Upgrade" button → `/pricing`
   - **Duration:** 8 seconds

2. **Out of Credits Modal**
   - **File:** `components/modals/out-of-credits-modal.tsx`
   - **Trigger:** User tries to upload with 0 credits
   - **Message:** "You've used all your credits for this month."
   - **Action:** "Upgrade to Pro" button → `/pricing`

3. **Out of Credits Banner**
   - **File:** `components/ui/out-of-credits-banner.tsx`
   - **Trigger:** Dashboard pages when credits = 0
   - **Message:** "You're out of credits. Upgrade to keep creating."
   - **Action:** "Upgrade Now" button → `/pricing`

4. **Rate Limit Reached**
   - **File:** `components/reels/video-upload-interface.tsx`
   - **Trigger:** 3 uploads in 1 hour (Redis rate limit)
   - **Message:** "Rate limit reached. Upgrade for unlimited uploads."
   - **Action:** "Upgrade" button → `/pricing`

5. **Settings Page Upgrade CTA**
   - **File:** `components/settings/subscription-card.tsx`
   - **Trigger:** Always visible for free tier users
   - **Message:** "Upgrade to Pro" button
   - **Action:** → `/pricing`

---

## SECTION 6: AUTHENTICATION & USER FLOW

### 6.1 New User Signup

**Flow:**

```
1. USER VISITS SIGNUP PAGE
   ↓
   URL: /auth/signup
   ↓
   File: app/auth/signup/page.tsx
   ↓
   Renders: <SignupForm />

2. USER ENTERS EMAIL + PASSWORD
   ↓
   File: components/auth/signup-form.tsx
   ↓
   Form validation via Zod schema
   ↓
   Submits: { email, password, username (optional), acceptTerms }

3. SUPABASE AUTH SIGNUP
   ↓
   const { data, error } = await supabase.auth.signUp({
     email,
     password,
     options: {
       emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || window.location.origin
     }
   })
   ↓
   Creates row in auth.users table

4. DATABASE TRIGGER: handle_new_user()
   ↓
   File: scripts/phase-1a-auth-foundation.sql
   ↓
   Trigger: on_auth_user_created
   ↓
   Logic:
   - INSERT INTO public.users (
       id,
       email,
       name,
       avatar_url,
       subscription_tier,
       subscription_status,
       credits_remaining,
       monthly_credit_allowance,
       is_onboarded
     )
   - VALUES (
       new.id,
       new.email,
       new.raw_user_meta_data->>'full_name',
       new.raw_user_meta_data->>'avatar_url',
       'free',
       'active',
       0,
       5,
       false
     )

5. DATABASE TRIGGER: grant_welcome_bonus()
   ↓
   File: scripts/001_welcome_bonus_setup.sql
   ↓
   Trigger: grant_welcome_bonus_trigger
   ↓
   Logic:
   - Calls: grant_credits(5, 'welcome_bonus', NULL, NULL, new.id)
   - Updates: users.credits_remaining = 5
   - Inserts: credit_ledger (delta=5, reason='welcome_bonus')

6. USER REDIRECTED TO DASHBOARD
   ↓
   URL: /dashboard/pets
   ↓
   User has:
   - subscription_tier = 'free'
   - subscription_status = 'active'
   - credits_remaining = 5
   - monthly_credit_allowance = 5
   - stripe_customer_id = NULL
```

**User Metadata Stored:**
- `email` - User's email address
- `username` - Optional display name
- `full_name` - Optional full name
- `avatar_url` - Profile picture (if provided)

**Initial State:**
- Tier: Free
- Status: Active
- Credits: 5 (welcome bonus)
- Monthly Allowance: 5
- Stripe Customer: Not created yet

### 6.2 User State Management

**No Global State Management:**
- No Redux, Zustand, or Context API
- Each component fetches its own data
- Potential for stale data

**Data Fetching Patterns:**

1. **Server Components (Preferred):**
```typescript
// app/dashboard/settings/page.tsx
export default async function SettingsPage() {
  const user = await getUser()
  
  const supabase = await createClient()
  const { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()
  
  return <SubscriptionCard user={userData} />
}
```

2. **Client Components (useEffect):**
```typescript
// components/settings/subscription-card.tsx
"use client"

export function SubscriptionCard({ user }: { user: any }) {
  const [subscription, setSubscription] = useState(null)
  
  useEffect(() => {
    async function fetchSubscription() {
      const supabase = createClient()
      const { data } = await supabase
        .from("users")
        .select("subscription_tier, credits_remaining, ...")
        .eq("id", user.id)
        .single()
      
      setSubscription(data)
    }
    
    fetchSubscription()
  }, [user.id])
  
  return <div>{subscription?.credits_remaining} credits</div>
}
```

3. **Custom Hooks:**
```typescript
// hooks/use-credits.ts
export function useCredits() {
  const [credits, setCredits] = useState(null)
  
  useEffect(() => {
    async function fetchCredits() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data } = await supabase
        .from("users")
        .select("credits_remaining")
        .eq("id", user.id)
        .single()
      
      setCredits(data?.credits_remaining ?? 0)
    }
    
    fetchCredits()
  }, [])
  
  return { credits, refetch: fetchCredits }
}
```

**Refresh Strategies:**
- Manual refetch via `refetch()` function
- Page reload
- No automatic polling
- No real-time subscriptions

**Potential Issues:**
- Stale credit balance after deduction
- Multiple components fetching same data
- No cache invalidation strategy

### 6.3 Protected Routes

**Middleware:**

**File:** `middleware.ts`

**Logic:**
```typescript
export async function middleware(request: NextRequest) {
  const { response, supabase } = await updateSession(request)
  
  const pathname = request.nextUrl.pathname
  
  // 1. Refresh Supabase session
  const { data: { session } } = await supabase.auth.getSession()
  
  // 2. Protect /dashboard/* routes
  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      return NextResponse.redirect(
        new URL(`/auth/login?redirectTo=${pathname}`, request.url)
      )
    }
  }
  
  // 3. Redirect authenticated users away from auth pages
  if (pathname.startsWith("/auth/") && session) {
    return NextResponse.redirect(new URL("/dashboard/pets", request.url))
  }
  
  return response
}
```

**Protected Routes:**
- `/dashboard/*` - Requires authentication
- All other routes are public

**No Subscription Checks:**
- Middleware does NOT check subscription status
- Middleware does NOT check credit balance
- All authenticated users can access dashboard

**Credit Checks:**
- Performed at component level (preflight check)
- Not enforced at route level

---

## SECTION 7: CURRENT PRICING MODEL

### 7.1 Free Tier

**Credits:** 5 per month  
**Price:** $0  
**Features:**
- 5 videos per month
- Standard processing
- HD video quality
- Email support
- All personality voices

**Limitations:**
- Credits reset on 1st of month
- No rollover
- Rate limited: 3 uploads per hour

**Target Audience:** Casual users, trial users

### 7.2 Paid Tiers

| Tier | Monthly | Annual | Credits | Savings |
|------|---------|--------|---------|---------|
| **Basic** | $9/mo | $90/yr | 25 | $18/yr (17%) |
| **Pro** | $19/mo | $190/yr | 75 | $38/yr (17%) |
| **Premium** | $49/mo | $490/yr | 200 | $98/yr (17%) |

**Basic Features:**
- 25 videos per month
- Standard processing
- HD video quality
- Email support
- All personality voices

**Pro Features (Popular):**
- 75 videos per month
- Priority processing
- HD video quality
- Priority email support
- All personality voices
- Custom voices (coming soon)

**Premium Features:**
- 200 videos per month
- Priority processing
- 4K video quality
- Priority support
- All personality voices
- Custom voices
- API access (coming soon)
- White-label option (coming soon)

### 7.3 Stripe Products

**Test Mode Products:**

**Basic:**
- Monthly: `price_test_basic_monthly` (env var: STRIPE_BASIC_MONTHLY_PRICE_ID)
- Annual: `price_test_basic_annual` (env var: STRIPE_BASIC_ANNUAL_PRICE_ID)

**Pro:**
- Monthly: `price_test_pro_monthly` (env var: STRIPE_PRO_MONTHLY_PRICE_ID)
- Annual: `price_test_pro_annual` (env var: STRIPE_PRO_ANNUAL_PRICE_ID)

**Premium:**
- Monthly: `price_test_premium_monthly` (env var: STRIPE_PREMIUM_MONTHLY_PRICE_ID)
- Annual: `price_test_premium_annual` (env var: STRIPE_PREMIUM_ANNUAL_PRICE_ID)

**Product Structure in Stripe:**
```
Product: Pet Tales AI - Basic
├─ Price: $9/month (recurring)
└─ Price: $90/year (recurring)

Product: Pet Tales AI - Pro
├─ Price: $19/month (recurring)
└─ Price: $190/year (recurring)

Product: Pet Tales AI - Premium
├─ Price: $49/month (recurring)
└─ Price: $490/year (recurring)
```

**Metadata:**
- `tier`: "basic" | "pro" | "premium"
- `credits`: 25 | 75 | 200
- `billing_interval`: "monthly" | "annual"

---

## SECTION 8: DEPENDENCIES & INTEGRATIONS

### 8.1 NPM Packages

**File:** `package.json`

**Stripe-Related:**
```json
{
  "dependencies": {
    "stripe": "^17.5.0"
  }
}
```

**Version:** 17.5.0 (latest as of Dec 2024)

**Other Payment-Related:** None

**Data Fetching:**
- No React Query or SWR
- Native fetch API
- Supabase client for database queries

### 8.2 External Services

**Supabase:**
- **Purpose:** Authentication, database, storage
- **Features Used:**
  - Auth (email/password)
  - PostgreSQL database
  - Row Level Security (RLS)
  - Database functions (RPC)
  - Storage buckets (videos, pet-voices)
- **Integration:** `@supabase/auth-helpers-nextjs`

**Stripe:**
- **Purpose:** Payment processing, subscription management
- **Features Used:**
  - Checkout Sessions
  - Subscriptions
  - Customers
  - Webhooks (not yet implemented)
- **Integration:** `stripe` npm package

**Cloudinary:**
- **Purpose:** Video processing, compression, transformation
- **Features Used:**
  - Video upload
  - Compression
  - Audio overlay
  - Caption burn-in
  - Webhooks
- **Integration:** `cloudinary` npm package

**ElevenLabs:**
- **Purpose:** Text-to-speech voice generation
- **Cost:** $0.30 per 1000 characters
- **Integration:** Direct API calls

**OpenAI Whisper:**
- **Purpose:** Audio transcription for captions
- **Cost:** $0.006 per minute
- **Integration:** `openai` npm package

**Vercel:**
- **Purpose:** Hosting, deployment, environment variables
- **Features Used:**
  - Next.js hosting
  - Environment variables
  - Preview deployments
- **Integration:** Native Next.js deployment

### 8.3 Cron Jobs

**pg_cron Extension:**

**File:** `scripts/20241224000001_monthly_credit_reset_cron.sql`

**Job:** `monthly-credit-reset`

**Schedule:** `5 0 1 * *` (At 00:05 UTC on day 1 of every month)

**Function:** `reset_monthly_credits()`

**Logic:**
1. Find all users where `credit_reset_date` is NULL or older than 25 days
2. Grant `monthly_credit_allowance` credits to each user
3. Update `credit_reset_date` to now()
4. Log results to `credit_reset_logs` table

**Monitoring:**
```sql
-- View recent resets
SELECT * FROM credit_reset_logs 
ORDER BY reset_date DESC 
LIMIT 100;

-- View cron job status
SELECT * FROM cron.job 
WHERE jobname = 'monthly-credit-reset';

-- View cron job history
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'monthly-credit-reset')
ORDER BY start_time DESC 
LIMIT 10;
```

**No Other Cron Jobs:**
- No subscription renewal checks
- No payment failure notifications
- No usage reports

---

## SECTION 9: TESTING & ERROR SCENARIOS

### 9.1 Error Handling

**Stripe Checkout Fails:**

**Scenario:** User clicks "Subscribe" but Stripe API returns error

**Handling:**
```typescript
// File: app/pricing/pricing-client.tsx
try {
  const response = await fetch("/api/stripe/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ priceId }),
  })
  
  if (!response.ok) {
    throw new Error("Failed to create checkout session")
  }
  
  const { url } = await response.json()
  window.location.href = url
  
} catch (error) {
  toast({
    title: "Error",
    description: "Failed to start checkout. Please try again.",
    variant: "destructive",
  })
}
```

**User Experience:**
- Error toast shown
- User remains on pricing page
- Can retry checkout

**Webhook Fails to Process:**

**Status:** ❌ **NOT IMPLEMENTED**

**Expected Handling:**
- Stripe retries webhook up to 3 times
- If all retries fail, event is marked as failed in Stripe dashboard
- Admin must manually process event
- User's subscription is not activated

**Current Issue:**
- No webhook handler exists
- All webhooks fail
- Subscriptions never activate

**User Has No Credits:**

**Scenario:** User tries to upload video with 0 credits

**Handling:**
```typescript
// File: components/reels/video-upload-interface.tsx
const balanceCheck = await preflightBalanceCheck()

if (balanceCheck.outcome === "blocked") {
  setShowOutOfCreditsModal(true)
  return
}
```

**User Experience:**
- Modal shown: "Out of Credits"
- "Upgrade to Pro" CTA
- Upload blocked

**Subscription Expires:**

**Status:** ❌ **NOT IMPLEMENTED**

**Expected Handling:**
- Stripe webhook: `customer.subscription.deleted`
- Update database:
  - subscription_status = 'canceled'
  - subscription_tier = 'free'
  - monthly_credit_allowance = 5
- User retains current credits until next reset
- User can continue using app with free tier

**Current Issue:**
- No webhook handler
- Subscription status never updated
- User may have access to paid features indefinitely

**Payment Fails:**

**Status:** ❌ **NOT IMPLEMENTED**

**Expected Handling:**
- Stripe webhook: `invoice.payment_failed`
- Update database:
  - subscription_status = 'past_due'
- Send email notification to user
- Stripe retries payment automatically
- After 3 failed attempts, subscription is canceled

**Current Issue:**
- No webhook handler
- No payment failure notifications
- User unaware of payment issues

### 9.2 Error Messages

**User-Facing Messages:**

| Scenario | Message | Location |
|----------|---------|----------|
| Out of credits | "You don't have enough credits to create a video." | OutOfCreditsModal |
| Rate limit reached | "You've reached the upload limit. Please try again later." | Toast |
| Checkout failed | "Failed to start checkout. Please try again." | Toast |
| Auth required | "Please sign in to continue." | Redirect to login |
| Invalid price ID | "Invalid plan selected. Please try again." | Toast |
| Server error | "Something went wrong. Please try again later." | Toast |

**Developer Messages (Console):**

```typescript
console.log("[v0] User data received:", userData)
console.log("[v0] API call starting with params:", params)
console.log("[v0] Component rendered with props:", props)
console.log("[v0] Error occurred in function:", error.message)
console.log("[v0] State updated:", newState)
```

**Error Logging:**
- Console.log statements throughout codebase
- No centralized error tracking (Sentry, LogRocket, etc.)
- No error reporting to admin dashboard

### 9.3 Testing

**Status:** ❌ **NO TESTS FOUND**

**Missing Tests:**
- No unit tests for credit logic
- No integration tests for Stripe checkout
- No E2E tests for user flows
- No webhook testing

**Manual Testing Checklist:**

```
□ Signup flow
  □ Create new account
  □ Verify 5 welcome credits granted
  □ Verify credit_ledger entry created

□ Credit deduction
  □ Upload video
  □ Verify preflight check passes
  □ Verify credits deducted after processing
  □ Verify credit_ledger entry created

□ Out of credits
  □ Use all credits
  □ Verify upload blocked
  □ Verify modal shown

□ Checkout flow
  □ Click "Subscribe" on pricing page
  □ Complete Stripe checkout
  □ Verify redirect to settings page
  □ Verify success toast shown
  □ [FAILS] Verify subscription activated
  □ [FAILS] Verify credits granted

□ Monthly reset
  □ Wait for 1st of month
  □ Verify credits reset
  □ Verify credit_ledger entry created
  □ Verify credit_reset_date updated

□ Subscription management
  □ [NOT IMPLEMENTED] Cancel subscription
  □ [NOT IMPLEMENTED] Change plan
  □ [NOT IMPLEMENTED] Update payment method
```

---

## SECTION 10: MIGRATION IMPACT ASSESSMENT

### 10.1 Files That Will Need Changes

**Database (7 files):**
- `scripts/20241224000000_stripe_subscription_schema.sql` - Remove subscription columns, add pack purchase columns
- `scripts/20241224000001_monthly_credit_reset_cron.sql` - Remove monthly reset cron job
- `scripts/phase-3a-credits-ledger-v3.sql` - Update grant_credits() to accept 'pack_purchase' reason
- `scripts/001_welcome_bonus_setup.sql` - Keep as-is (welcome bonus still needed)
- `scripts/phase-1a-auth-foundation.sql` - Update handle_new_user() to remove subscription defaults
- New file: `scripts/pack_purchase_schema.sql` - Add pack purchase tracking table
- New file: `scripts/remove_subscription_columns.sql` - Migration to remove old columns

**API Routes (4 files):**
- `app/api/stripe/create-checkout-session/route.ts` - Change mode from "subscription" to "payment"
- New file: `app/api/stripe/webhook/route.ts` - Handle payment_intent.succeeded event
- Remove file: `app/api/stripe/create-portal-session/route.ts` (if exists)
- Keep: `app/api/credits/balance/route.ts`, `app/api/credits/preflight/route.ts`

**Business Logic (3 files):**
- `app/actions/credit-actions.ts` - Keep as-is (preflight check still needed)
- `lib/pricing-config.ts` - Replace subscription tiers with credit packs
- New file: `lib/pack-config.ts` - Define credit pack options

**UI Components (8 files):**
- `app/pricing/page.tsx` - Replace subscription cards with pack cards
- `app/pricing/pricing-client.tsx` - Update checkout logic for one-time payments
- `components/settings/subscription-card.tsx` - Replace with credit balance card
- `components/ui/credits-badge.tsx` - Keep as-is
- `components/ui/out-of-credits-banner.tsx` - Update CTA to "Buy More Credits"
- `components/modals/out-of-credits-modal.tsx` - Update CTA to "Buy Credits"
- `components/reels/video-upload-interface.tsx` - Update warning toast
- New file: `components/settings/purchase-history-card.tsx` - Show pack purchase history

**Configuration (2 files):**
- `lib/stripe.ts` - Keep as-is
- `types/stripe.ts` - Update types for one-time payments

**Total Files to Change:** 24 files  
**Total Files to Create:** 4 files  
**Total Files to Remove:** 2 files

### 10.2 Files That Can Be Removed

**Subscription-Specific:**
- `scripts/20241224000001_monthly_credit_reset_cron.sql` - Monthly reset no longer needed
- `app/api/stripe/create-portal-session/route.ts` - Customer portal not needed for one-time payments

**Potentially Remove:**
- Database columns: `subscription_tier`, `subscription_status`, `monthly_credit_allowance`, `subscription_period_start`, `subscription_period_end`, `subscription_cancel_at_period_end`, `credit_reset_date`
- Keep: `stripe_customer_id` (still needed for one-time payments)
- Keep: `credits_remaining` (core to credit system)

### 10.3 Files That Need Creation

**New Database Schema:**
1. `scripts/pack_purchase_schema.sql`
   - Create `pack_purchases` table
   - Track purchase history
   - Store Stripe payment_intent_id

**New API Routes:**
2. `app/api/stripe/webhook/route.ts`
   - Handle `payment_intent.succeeded` event
   - Grant credits on successful payment
   - Log to pack_purchases table

**New Configuration:**
3. `lib/pack-config.ts`
   - Define credit pack options
   - Map Stripe price IDs to credit amounts
   - Calculate pricing

**New UI Components:**
4. `components/settings/purchase-history-card.tsx`
   - Display pack purchase history
   - Show transaction details

### 10.4 Breaking Changes

**What Will Stop Working:**

1. **Monthly Credit Resets**
   - Cron job will be removed
   - Users will no longer receive automatic credits
   - Impact: All users (free and paid)

2. **Subscription Management**
   - "Change Plan" button will be removed
   - "Manage Billing" button will be removed
   - Impact: Paid subscribers

3. **Subscription Status Display**
   - "Current Plan" badge will be removed
   - "Renewal Date" will be removed
   - Impact: All users

4. **Free Tier**
   - No more monthly allowance
   - Users must purchase credits
   - Impact: Free tier users

**What Needs to Be Built Before Removing Old Code:**

1. **Pack Purchase Flow**
   - New pricing page with pack options
   - Checkout session creation for one-time payments
   - Webhook handler for payment_intent.succeeded

2. **Credit Purchase History**
   - Database table for pack_purchases
   - UI component to display history

3. **Migration Script**
   - Convert existing users to new system
   - Grant one-time credit bonus to existing paid subscribers
   - Communicate changes to users

4. **Welcome Bonus**
   - Keep welcome bonus for new users
   - Update to grant credits without subscription

### 10.5 Complexity Assessment

| Subsystem | Complexity | Risk Level | Effort (hours) |
|-----------|-----------|------------|----------------|
| **Database Schema** | **Moderate** | Low | 4-6 hours |
| - Remove subscription columns | Simple | Low | 1 hour |
| - Add pack purchase table | Simple | Low | 2 hours |
| - Update grant_credits() | Simple | Low | 1 hour |
| - Migration script | Moderate | Medium | 2-3 hours |
| **Stripe Integration** | **Moderate** | Medium | 6-8 hours |
| - Update checkout session | Simple | Low | 2 hours |
| - Implement webhook handler | Moderate | Medium | 4-6 hours |
| **Credit Logic** | **Simple** | Low | 2-3 hours |
| - Update pricing config | Simple | Low | 1 hour |
| - Create pack config | Simple | Low | 1 hour |
| - Update grant reasons | Simple | Low | 1 hour |
| **UI Components** | **Moderate** | Low | 8-10 hours |
| - Pricing page redesign | Moderate | Low | 4-5 hours |
| - Settings page updates | Simple | Low | 2-3 hours |
| - Purchase history component | Simple | Low | 2 hours |
| **Testing** | **Complex** | High | 6-8 hours |
| - Manual testing | Moderate | Medium | 3-4 hours |
| - Webhook testing | Moderate | High | 3-4 hours |
| **Documentation** | **Simple** | Low | 2-3 hours |
| - Update README | Simple | Low | 1 hour |
| - User communication | Simple | Low | 1-2 hours |

**Total Estimated Effort:** 28-38 hours

**Highest Risk Changes:**
1. **Webhook Handler** - Critical for credit grants, must be tested thoroughly
2. **Database Migration** - Must not lose existing user data
3. **Existing Paid Subscribers** - Must handle gracefully, communicate changes

**Recommended Approach:**
1. Build new pack-based system alongside existing subscription system
2. Test thoroughly in development
3. Migrate existing users with communication and grace period
4. Remove old subscription code after migration is complete

---

## COMPLETE FILE INVENTORY

### Database Files (10 files, ~2000 lines)

| File | Purpose | LOC | Status |
|------|---------|-----|--------|
| `scripts/phase-1a-auth-foundation.sql` | User table, auth trigger | 150 | ✅ Complete |
| `scripts/phase-3a-credits-ledger-v3.sql` | Credit ledger, grant/debit functions | 300 | ✅ Complete |
| `scripts/20241224000000_stripe_subscription_schema.sql` | Stripe subscription columns | 400 | ✅ Complete |
| `scripts/20241224000001_monthly_credit_reset_cron.sql` | Monthly reset cron job | 300 | ✅ Complete |
| `scripts/001_welcome_bonus_setup.sql` | Welcome bonus trigger | 100 | ✅ Complete |
| `scripts/002_backfill_existing_users.sql` | Backfill script | 50 | ✅ Complete |
| `scripts/003_verification_queries.sql` | Verification queries | 50 | ✅ Complete |
| `scripts/004_rollback_procedures.sql` | Rollback procedures | 100 | ✅ Complete |
| `scripts/phase-3a-acceptance-tests-v3.sql` | Acceptance tests | 200 | ✅ Complete |
| `scripts/phase-3a-1-hard-mode-v2.sql` | Hard mode debit function | 150 | ✅ Complete |

### API Routes (7 files, ~800 lines)

| File | Purpose | LOC | Status |
|------|---------|-----|--------|
| `app/api/stripe/create-checkout-session/route.ts` | Checkout session creation | 200 | ✅ Complete |
| `app/api/credits/balance/route.ts` | Credit balance API | 50 | ✅ Complete |
| `app/api/credits/preflight/route.ts` | Preflight check API | 50 | ✅ Complete |
| `app/api/cloudinary/webhook/route.ts` | Cloudinary webhook (credit deduction) | 300 | ✅ Complete |
| `app/api/n8n-direct/route.ts` | Entry creation | 100 | ✅ Complete |
| `app/api/video/compress/route.ts` | Video compression | 100 | ✅ Complete |
| `app/api/stripe/webhook/route.ts` | Stripe webhook handler | 0 | ❌ **MISSING** |

### Business Logic (5 files, ~600 lines)

| File | Purpose | LOC | Status |
|------|---------|-----|--------|
| `app/actions/credit-actions.ts` | Preflight balance check | 150 | ✅ Complete |
| `app/actions/credits-api-actions.ts` | Credit balance fetching | 150 | ✅ Complete |
| `lib/pricing-config.ts` | Pricing tiers configuration | 200 | ✅ Complete |
| `lib/stripe.ts` | Stripe SDK initialization | 20 | ✅ Complete |
| `lib/stripe-errors.ts` | Stripe error formatting | 80 | ✅ Complete |

### UI Components (12 files, ~1500 lines)

| File | Purpose | LOC | Status |
|------|---------|-----|--------|
| `app/pricing/page.tsx` | Pricing page (server) | 50 | ✅ Complete |
| `app/pricing/pricing-client.tsx` | Pricing page (client) | 250 | ✅ Complete |
| `app/dashboard/settings/page.tsx` | Settings page | 100 | ✅ Complete |
| `components/settings/subscription-card.tsx` | Subscription display | 250 | ✅ Complete |
| `components/ui/credits-badge.tsx` | Credit balance badge | 100 | ✅ Complete |
| `components/ui/out-of-credits-banner.tsx` | Out of credits banner | 100 | ✅ Complete |
| `components/modals/out-of-credits-modal.tsx` | Out of credits modal | 150 | ✅ Complete |
| `components/reels/video-upload-interface.tsx` | Upload interface | 400 | ✅ Complete |
| `hooks/use-credits.ts` | Credit balance hook | 100 | ✅ Complete |
| `app/auth/signup/page.tsx` | Signup page | 50 | ✅ Complete |
| `components/auth/signup-form.tsx` | Signup form | 200 | ✅ Complete |
| `components/auth/login-form.tsx` | Login form | 150 | ✅ Complete |

### Configuration & Types (3 files, ~200 lines)

| File | Purpose | LOC | Status |
|------|---------|-----|--------|
| `types/stripe.ts` | Stripe TypeScript types | 50 | ✅ Complete |
| `lib/types/credit-types.ts` | Credit TypeScript types | 50 | ✅ Complete |
| `middleware.ts` | Auth middleware | 100 | ✅ Complete |

**Total Files:** 37 files  
**Total Lines of Code:** ~5100 lines  
**Complete:** 36 files (97%)  
**Missing:** 1 file (3%) - Stripe webhook handler

---

## DATA FLOW DIAGRAMS

### Current: Signup → Credits → Video Creation → Deduction

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPLETE USER FLOW                        │
└─────────────────────────────────────────────────────────────┘

1. SIGNUP
   User visits /auth/signup
   ↓
   Enters email + password
   ↓
   supabase.auth.signUp()
   ↓
   auth.users INSERT
   ↓
   Trigger: handle_new_user()
   ↓
   public.users INSERT
   - subscription_tier = 'free'
   - subscription_status = 'active'
   - credits_remaining = 0
   - monthly_credit_allowance = 5
   ↓
   Trigger: grant_welcome_bonus()
   ↓
   grant_credits(5, 'welcome_bonus')
   ↓
   users.credits_remaining = 5
   ↓
   credit_ledger INSERT (delta=5)
   ↓
   Redirect to /dashboard/pets

2. VIDEO CREATION
   User visits /dashboard/reels/new
   ↓
   Component mounts
   ↓
   preflightBalanceCheck()
   ↓
   Query: SELECT credits_remaining FROM users
   ↓
   IF credits_remaining < 1:
     Show OutOfCreditsModal
     Block upload
   ELSE:
     Show upload UI
   ↓
   User uploads video
   ↓
   POST /api/n8n-direct
   ↓
   diary_entries INSERT
   - status = 'pending'
   - credits_debited = false
   ↓
   POST /api/video/compress
   ↓
   Cloudinary upload + compression
   ↓
   Cloudinary webhook
   ↓
   POST /api/cloudinary/webhook
   ↓
   debit_credits_for_entry(entry_id, duration)
   ↓
   Calculate: credits_needed = CEIL(duration / 60)
   ↓
   Check: credits_remaining >= credits_needed
   ↓
   IF insufficient:
     diary_entries UPDATE
     - billing_status = 'billing_required'
     Return error
   ELSE:
     Atomic transaction:
     - users UPDATE: credits_remaining -= credits_needed
     - diary_entries UPDATE: credits_debited = true
     - credit_ledger INSERT: delta = -credits_needed
     Return success
   ↓
   Continue processing (TTS, merged video)
   ↓
   User sees completed video

3. MONTHLY RESET
   Cron job runs: 1st of month, 00:05 UTC
   ↓
   reset_monthly_credits()
   ↓
   FOR EACH user WHERE credit_reset_date < now() - 25 days:
     grant_credits(monthly_credit_allowance, 'monthly_reset')
     ↓
     users UPDATE:
     - credits_remaining += monthly_credit_allowance
     - credit_reset_date = now()
     ↓
     credit_ledger INSERT (delta=monthly_credit_allowance)
   ↓
   Log results to credit_reset_logs

4. SUBSCRIPTION PURCHASE (BROKEN)
   User visits /pricing
   ↓
   Clicks "Subscribe"
   ↓
   POST /api/stripe/create-checkout-session
   ↓
   Stripe checkout session created
   ↓
   Redirect to Stripe Checkout
   ↓
   User enters payment details
   ↓
   Stripe processes payment
   ↓
   Stripe webhook: customer.subscription.created
   ↓
   [WEBHOOK HANDLER MISSING]
   ↓
   ❌ Subscription NOT activated
   ❌ Credits NOT granted
   ❌ User cannot create videos
   ↓
   Redirect to /dashboard/settings?success=true
   ↓
   Success toast shown
   ↓
   But subscription data NOT updated in database
```

### Current: Subscribe → Stripe → Webhook → Database (BROKEN)

```
┌─────────────────────────────────────────────────────────────┐
│              SUBSCRIPTION FLOW (BROKEN)                      │
└─────────────────────────────────────────────────────────────┘

1. USER CLICKS "SUBSCRIBE"
   /pricing page
   ↓
   handleCheckout(priceId, tierName)
   ↓
   POST /api/stripe/create-checkout-session
   ↓
   Body: { priceId: "price_test_basic_monthly" }

2. CREATE CHECKOUT SESSION
   app/api/stripe/create-checkout-session/route.ts
   ↓
   Validate priceId
   ↓
   Fetch user data
   ↓
   Create/retrieve Stripe customer
   ↓
   Save stripe_customer_id to database
   ↓
   stripe.checkout.sessions.create({
     customer: customerId,
     mode: "subscription",
     line_items: [{ price: priceId, quantity: 1 }],
     success_url: "/dashboard/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}&success=true",
     cancel_url: "/pricing?canceled=true",
     metadata: { userId, userEmail }
   })
   ↓
   Return: { sessionId, url }

3. REDIRECT TO STRIPE
   window.location.href = url
   ↓
   User sees Stripe Checkout page
   ↓
   User enters payment details
   ↓
   User clicks "Subscribe"

4. STRIPE PROCESSES PAYMENT
   Stripe creates subscription
   ↓
   Stripe sends webhook: customer.subscription.created
   ↓
   POST /api/stripe/webhook
   ↓
   ❌ WEBHOOK HANDLER DOES NOT EXIST
   ↓
   Webhook fails
   ↓
   Stripe retries 3 times
   ↓
   All retries fail
   ↓
   Event marked as failed in Stripe dashboard

5. USER REDIRECTED TO SUCCESS PAGE
   /dashboard/settings?tab=billing&session_id=cs_test_xxx&success=true
   ↓
   Success toast shown: "🎉 Welcome to Pet Tales AI Basic!"
   ↓
   BUT:
   ❌ stripe_subscription_id = NULL
   ❌ stripe_price_id = NULL
   ❌ subscription_tier = 'free'
   ❌ subscription_status = 'active'
   ❌ monthly_credit_allowance = 5
   ❌ credits_remaining = 5 (only welcome bonus)
   ↓
   User thinks subscription is active
   ↓
   But database shows free tier
   ↓
   User cannot create more than 5 videos

6. EXPECTED WEBHOOK FLOW (NOT IMPLEMENTED)
   POST /api/stripe/webhook
   ↓
   Verify signature
   ↓
   Check idempotency (stripe_webhook_events table)
   ↓
   Parse event: customer.subscription.created
   ↓
   Extract:
   - subscription.id
   - subscription.items.data[0].price.id
   - subscription.current_period_start
   - subscription.current_period_end
   - subscription.metadata.userId
   ↓
   Map price_id to tier:
   - price_test_basic_monthly → 'basic'
   - price_test_pro_monthly → 'pro'
   - price_test_premium_monthly → 'premium'
   ↓
   Map tier to monthly_credit_allowance:
   - 'basic' → 25
   - 'pro' → 75
   - 'premium' → 200
   ↓
   Update users table:
   - stripe_subscription_id = subscription.id
   - stripe_price_id = price.id
   - subscription_tier = tier
   - subscription_status = 'active'
   - monthly_credit_allowance = allowance
   - subscription_period_start = current_period_start
   - subscription_period_end = current_period_end
   ↓
   Grant credits:
   - grant_credits(monthly_credit_allowance, 'subscription_renewal')
   ↓
   Insert into stripe_webhook_events:
   - event_id = event.id
   - event_type = 'customer.subscription.created'
   - user_id = userId
   - payload = event
   - status = 'processed'
   ↓
   Return 200 OK to Stripe
```

### Current: Monthly Reset Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  MONTHLY RESET FLOW                          │
└─────────────────────────────────────────────────────────────┘

TRIGGER: 1st of every month at 00:05 UTC

1. CRON JOB EXECUTES
   pg_cron.schedule('monthly-credit-reset', '5 0 1 * *', ...)
   ↓
   Calls: reset_monthly_credits()

2. FIND ELIGIBLE USERS
   SELECT * FROM users
   WHERE (
     credit_reset_date IS NULL 
     OR credit_reset_date < (now() - interval '25 days')
   )
   AND subscription_status = 'active'
   ↓
   Returns: List of users who need credit reset

3. FOR EACH USER
   ↓
   Get: monthly_credit_allowance (5, 25, 75, or 200)
   ↓
   Call: grant_credits(
     amount: monthly_credit_allowance,
     reason: 'monthly_reset',
     entry_id: NULL,
     metadata: {
       previous_balance: credits_remaining,
       tier: subscription_tier,
       reset_date: now()
     },
     target_user: user_id
   )
   ↓
   grant_credits() executes:
   - credit_ledger INSERT (delta=monthly_credit_allowance)
   - users UPDATE: credits_remaining += monthly_credit_allowance
   ↓
   Update: credit_reset_date = now()
   ↓
   Log to credit_reset_logs:
   - user_id
   - credits_granted
   - new_balance
   - status: 'success'

4. HANDLE ERRORS
   IF grant_credits() fails:
     Log to credit_reset_logs:
     - user_id
     - credits_granted: 0
     - new_balance: unchanged
     - status: 'error: <error_message>'
     ↓
     Continue to next user (don't stop entire job)

5. COMPLETION
   Return: Table of results
   - user_id
   - credits_granted
   - new_balance
   - status
   ↓
   Cron job completes
   ↓
   Results logged to cron.job_run_details

MONITORING:
- View recent resets: SELECT * FROM credit_reset_logs ORDER BY reset_date DESC LIMIT 100;
- View cron status: SELECT * FROM cron.job WHERE jobname = 'monthly-credit-reset';
- View cron history: SELECT * FROM cron.job_run_details WHERE jobid = ... ORDER BY start_time DESC LIMIT 10;

GRACE PERIOD LOGIC:
- Resets credits if credit_reset_date is NULL (new user)
- Resets credits if credit_reset_date < (now() - 25 days)
- 25-day window allows 5-day grace period for users who might have unused credits
- Only resets for users with subscription_status = 'active'
```

---

## MIGRATION READINESS CHECKLIST

### What Exists That We Can Leverage

✅ **Credit System:**
- `credits_remaining` column (core to both models)
- `credit_ledger` table (audit trail)
- `grant_credits()` function (can be reused)
- `debit_credits_for_entry()` function (no changes needed)
- Preflight balance check (no changes needed)

✅ **Stripe Integration:**
- Stripe SDK initialized
- `stripe_customer_id` column (needed for one-time payments)
- Checkout session creation API (can be modified)
- Error handling utilities

✅ **UI Components:**
- Credits badge (no changes needed)
- Out of credits modal (minor text changes)
- Upload interface (no changes needed)
- Settings page (can be modified)

✅ **Database Infrastructure:**
- Supabase PostgreSQL
- RLS policies
- Database functions
- Triggers

### What Needs to Be Built From Scratch

❌ **Pack Purchase System:**
- `pack_purchases` table
- Pack configuration (lib/pack-config.ts)
- Pricing page redesign
- Purchase history UI

❌ **Stripe Webhook Handler:**
- `/api/stripe/webhook` route
- Event handling for `payment_intent.succeeded`
- Idempotency checking
- Credit granting on purchase

❌ **Migration Script:**
- Remove subscription columns
- Convert existing users
- Grant one-time credit bonus to paid subscribers
- Communicate changes

❌ **Documentation:**
- Update README
- User communication email
- FAQ updates

### What Needs to Be Removed

❌ **Subscription-Specific Code:**
- Monthly reset cron job
- Subscription columns (7 columns)
- Subscription display UI
- "Change Plan" / "Manage Billing" buttons

❌ **Subscription-Specific Config:**
- Subscription tiers in pricing-config.ts
- Monthly/Annual billing toggle
- Renewal date display

### Estimated Effort for Each Change

| Task | Complexity | Effort | Risk |
|------|-----------|--------|------|
| **Phase 1: Database** | | | |
| Create pack_purchases table | Simple | 2 hours | Low |
| Update grant_credits() | Simple | 1 hour | Low |
| Remove subscription columns | Moderate | 2 hours | Medium |
| Migration script | Moderate | 3 hours | Medium |
| **Phase 2: Stripe Integration** | | | |
| Update checkout session | Simple | 2 hours | Low |
| Implement webhook handler | Moderate | 6 hours | High |
| Test webhook locally | Moderate | 2 hours | Medium |
| **Phase 3: Configuration** | | | |
| Create pack-config.ts | Simple | 1 hour | Low |
| Update pricing-config.ts | Simple | 1 hour | Low |
| Update Stripe types | Simple | 1 hour | Low |
| **Phase 4: UI Components** | | | |
| Redesign pricing page | Moderate | 5 hours | Low |
| Update settings page | Simple | 3 hours | Low |
| Create purchase history | Simple | 2 hours | Low |
| Update CTAs | Simple | 2 hours | Low |
| **Phase 5: Testing** | | | |
| Manual testing | Moderate | 4 hours | Medium |
| Webhook testing | Moderate | 4 hours | High |
| User acceptance testing | Simple | 2 hours | Low |
| **Phase 6: Deployment** | | | |
| Documentation | Simple | 2 hours | Low |
| User communication | Simple | 2 hours | Low |
| Deploy to production | Simple | 1 hour | Medium |
| **TOTAL** | | **46 hours** | |

**Recommended Timeline:**
- Week 1: Database + Stripe Integration (12 hours)
- Week 2: Configuration + UI Components (14 hours)
- Week 3: Testing + Deployment (10 hours)
- Week 4: Buffer for issues (10 hours)

**Total: 4 weeks (part-time) or 1 week (full-time)**

---

## CONCLUSION

### Summary

Pet Tales AI has a **well-structured credit system** with atomic debit/grant operations, comprehensive audit trails, and proper idempotency protection. The database schema is solid and the credit logic is production-ready.

However, the **Stripe subscription integration is incomplete**. The checkout flow exists but the critical webhook handler is missing, meaning subscriptions never activate and users never receive their paid credits.

### Critical Missing Piece

**Stripe Webhook Handler** (`app/api/stripe/webhook/route.ts`)

This single missing file prevents the entire subscription system from working. Without it:
- Subscriptions are created in Stripe but not reflected in the database
- Users pay but don't receive credits
- Monthly renewals don't grant credits
- Cancellations don't update status

### Migration Feasibility

**Migrating from subscription to pack-based model is FEASIBLE** because:

1. **Credit system is decoupled** - The core credit logic doesn't depend on subscriptions
2. **Stripe integration is minimal** - Only checkout session creation exists, easy to modify
3. **UI is modular** - Components can be updated independently
4. **Database is flexible** - Can add pack_purchases table without breaking existing data

### Recommended Next Steps

**Option A: Complete Subscription System First**
1. Implement webhook handler (6 hours)
2. Test subscription flow (4 hours)
3. Deploy and validate (2 hours)
4. **Then** plan migration to packs

**Option B: Skip Subscriptions, Go Straight to Packs**
1. Remove incomplete subscription code (4 hours)
2. Build pack purchase system (20 hours)
3. Implement webhook handler for one-time payments (6 hours)
4. Test and deploy (10 hours)

**Recommendation:** **Option B** - Skip subscriptions entirely

**Reasoning:**
- Subscription system is incomplete and would take 12+ hours to finish
- Pack-based model is simpler (no recurring billing, no cancellations, no renewals)
- Less code to maintain
- Easier to test
- Better user experience (buy credits when needed, no monthly commitment)

### Final Thoughts

The codebase is in good shape for migration. The credit system is solid, the database is well-designed, and the UI is modular. The missing webhook handler is actually a **blessing in disguise** - it means you haven't committed to the subscription model yet, making the migration easier.

With 40-50 hours of focused development, you can have a fully functional pack-based credit system ready for production.

---

**End of Analysis**

*Generated: January 2025*  
*Analyst: v0 AI Assistant*  
*Project: Pet Tales AI - Stripe Integration & Credit System*
