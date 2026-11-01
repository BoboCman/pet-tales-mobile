# MOBILE UI AUDIT & CREDIT SYSTEM INTEGRATION

## PART 1: CURRENT STATE DOCUMENTATION

### A. Mobile Navigation Structure

**Current Mobile Navigation:** `components/layout/bottom-nav.tsx`

**Authenticated Users (5 items):**
1. Home (/)
2. Pets (/dashboard/pets)
3. Pet Tales (/dashboard/reels)
4. Community (/community/public)
5. Settings (/dashboard/settings)

**Unauthenticated Users (3 items):**
1. Home (/)
2. Community (/community/public)
3. Sign In (/auth/login)

**FINDING:** Pricing page (/pricing) is NOT in mobile navigation
**RECOMMENDATION:** Add "Upgrade" link to authenticated mobile nav (6th item)

---

### B. Upload/Create Flow Analysis

**Primary Upload Page:** `/app/dashboard/reels/new/page.tsx`

**Component:** `components/reels/video-upload-interface.tsx`

**User Journey:**
1. User navigates to /dashboard/reels/new
2. Selects pet from list
3. Chooses voice personality (6 options)
4. Clicks "Record Video" or "Upload Video"
5. Previews video
6. Clicks "Create Tale"
7. System checks credits BEFORE upload
8. If credits OK → uploads and processes
9. If credits = 0 → shows OutOfCreditsBanner

**Credit Check Locations:**
- ✅ Pre-upload check via `preflightBalanceCheck()` API
- ✅ Shows OutOfCreditsBanner when balance = 0
- ✅ Disables upload buttons when out of credits
- ✅ Displays current credit balance at bottom of page

**FINDING:** Credit check is implemented correctly, but UX could be improved

---

### C. Credit Balance Display Locations

**Current Display Locations:**

1. **Dashboard Layout Header (Mobile Only)**
   - File: `app/dashboard/layout.tsx`
   - Component: `<CreditsBadge />`
   - Visibility: Mobile only (md:hidden)
   - Location: Top of dashboard pages
   - Clickable: No (not a link)

2. **Top Header (Desktop Only)**
   - File: `components/layout/top-header.tsx`
   - Component: `<CreditsBadge />`
   - Visibility: Desktop only (hidden md:block)
   - Location: Top right corner
   - Clickable: No (not a link)

3. **Upload Page**
   - File: `components/reels/video-upload-interface.tsx`
   - Display: Text at bottom "Current credits: X • Each tale costs at least 1 credit"
   - Visibility: Always visible when creditBalance !== null

4. **Settings Page - Billing Tab**
   - File: `components/settings/subscription-card.tsx`
   - Display: Large credit counter with progress bar
   - Visibility: Only on /dashboard/settings?tab=billing

**GAPS IDENTIFIED:**
- ❌ Credit badge is NOT clickable (should link to billing settings)
- ❌ No credit indicator in bottom navigation
- ❌ No persistent credit warning when low (1 credit remaining)

---

### D. Error Handling for Zero Credits

**Current Implementation:**

**Component:** `components/ui/out-of-credits-banner.tsx`

**Triggers:**
- When `preflightBalanceCheck()` returns `OUT_OF_CREDITS` code
- Displayed at top of upload interface
- Blocks upload buttons (disabled state)

**Banner Content:**
- Alert icon (orange)
- Message: "You're out of credits."
- Description: "You need at least 1 credit to create a new pet tale. Your current balance is X credits."
- Actions:
  1. "Claim daily +1" button (calls /api/credits/faucet)
  2. "Contact support" button (opens email)

**FINDING:** Good implementation, but missing:
- ❌ No link to /pricing page
- ❌ No "Upgrade Now" CTA
- ❌ No modal/dialog when user tries to upload with 0 credits

---

## PART 2: PROPOSED FIXES

### FIX 1: Add Pricing to Mobile Navigation ✅

**Change:** Add 6th item to authenticated bottom nav

**Icon:** Zap (lightning bolt) - represents "power up"

**Position:** Between "Community" and "Settings"

**File:** `components/layout/bottom-nav.tsx`

---

### FIX 2: Make Credit Badge Clickable ✅

**Change:** Wrap CreditsBadge in Link component

**Destination:** `/dashboard/settings?tab=billing`

**Files:**
- `components/ui/credits-badge.tsx` (add Link wrapper)
- `app/dashboard/layout.tsx` (update usage)

---

### FIX 3: Enhanced Out of Credits Banner ✅

**Change:** Add "Upgrade Now" button to existing banner

**Button:** Primary CTA linking to /pricing

**File:** `components/ui/out-of-credits-banner.tsx`

---

### FIX 4: Out of Credits Modal ✅

**New Component:** `components/modals/out-of-credits-modal.tsx`

**Triggers:** When user clicks "Create Tale" with 0 credits

**Content:**
- Title: "You're out of credits!"
- Current tier display
- Next reset date (if applicable)
- "Upgrade Now" button → /pricing
- "Maybe later" button (closes modal)

**Uses:** shadcn Dialog component

---

### FIX 5: Credit Warning Toast at 1 Credit ✅

**Change:** Add toast notification when credits = 1

**Trigger:** After successful video creation

**Message:** "Last credit! Upgrade to keep creating."

**Action:** Link to /pricing

**File:** `components/reels/video-upload-interface.tsx`

---

### FIX 6: Mobile-Optimized Pricing Page ✅

**Change:** Ensure pricing page is mobile-responsive

**Enhancements:**
- Show current tier badge if logged in
- Sticky "Get Started" button on mobile
- Highlight recommended plan

**File:** `app/pricing/page.tsx` (already exists, verify mobile UX)

---

## PART 3: IMPLEMENTATION

### Implementation Order:
1. ✅ Add Pricing to mobile nav
2. ✅ Make credit badge clickable
3. ✅ Enhance out of credits banner
4. ✅ Create out of credits modal
5. ✅ Add credit warning toast
6. ✅ Verify pricing page mobile UX

---

## TESTING CHECKLIST

After implementation, verify:

- [ ] Pricing link appears in mobile nav (6th item)
- [ ] Credit badge is clickable and links to billing settings
- [ ] Out of credits banner shows "Upgrade Now" button
- [ ] Modal appears when trying to upload with 0 credits
- [ ] Modal has working "Upgrade Now" button → /pricing
- [ ] Toast appears at 1 credit remaining
- [ ] All components are mobile-responsive
- [ ] Credit balance updates after video creation
- [ ] Pricing page displays correctly on mobile
- [ ] Current tier badge shows on pricing page (if logged in)

---

## USER JOURNEYS OPTIMIZED

### JOURNEY 1: New Free User
1. Signs up → receives 5 free credits ✅
2. Creates first video → sees "4 credits remaining" ✅
3. Creates 4 more videos → sees "1 credit remaining" warning ✅ (NEW)
4. Tries to create 6th video → sees "Out of credits" modal ✅ (NEW)
5. Clicks "Upgrade Now" → lands on /pricing ✅ (NEW)
6. Subscribes to Basic → receives 25 credits ✅
7. Can continue creating videos ✅

### JOURNEY 2: Existing User on Mobile
1. Opens app on mobile → sees credit balance in header ✅
2. Taps credit balance → goes to billing settings ✅ (NEW)
3. Sees current plan and credit status ✅
4. Taps "Upgrade Plan" → goes to /pricing ✅
5. Completes upgrade → receives success message ✅
6. Returns to create page with new credits ✅

### JOURNEY 3: User Runs Out Mid-Month
1. User has 0 credits remaining ✅
2. Goes to create page → sees "Out of credits" banner ✅
3. Upload button is disabled ✅
4. Clicks "Upgrade Now" → goes to /pricing ✅ (NEW)
5. Sees current plan, sees higher tiers ✅
6. Can upgrade or wait for monthly reset ✅

---

## PRIORITY: HIGH

This directly impacts user conversion and prevents frustration when users hit credit limits. Mobile users are likely the majority of traffic.
