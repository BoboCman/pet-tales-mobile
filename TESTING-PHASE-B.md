# Phase B Testing Guide: Monthly Credit Reset with pg_cron

This guide provides step-by-step instructions for testing the monthly credit reset system.

## Prerequisites

- Phase A migration completed successfully
- Supabase Pro plan with pg_cron extension enabled
- Service role access to database
- At least one test user in the database

---

## Test 1: Verify pg_cron Extension

**Purpose:** Confirm pg_cron is enabled and ready to use

**SQL:**
```sql
SELECT 
    extname,
    extversion,
    extrelocatable,
    extowner::regrole AS owner
FROM pg_extension 
WHERE extname = 'pg_cron';
```

**Expected Output:**
```
extname  | extversion | extrelocatable | owner
---------|------------|----------------|-------
pg_cron  | 1.5        | false          | postgres
```

**If no rows returned:**
- Contact Supabase support to enable pg_cron extension
- Or use Edge Function approach as alternative (not covered in this guide)

---

## Test 2: Verify Tables and Functions Exist

**Purpose:** Confirm migration created all necessary objects

**SQL:**
```sql
-- Check credit_reset_logs table exists
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'credit_reset_logs'
) as table_exists;

-- Check reset_monthly_credits() function exists
SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'reset_monthly_credits'
) as function_exists;

-- Check admin_reset_user_credits() function exists
SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'admin_reset_user_credits'
) as admin_function_exists;
```

**Expected Output:**
```
table_exists | function_exists | admin_function_exists
-------------|-----------------|----------------------
true         | true            | true
```

---

## Test 3: Manual Single-User Reset

**Purpose:** Test credit reset logic on a single user

**Step 1: Get a test user**
```sql
SELECT 
    id, 
    email, 
    credits_remaining, 
    monthly_credit_allowance,
    credit_reset_date
FROM users 
LIMIT 1;
```

**Example Output:**
```
id                                   | email                    | credits_remaining | monthly_credit_allowance | credit_reset_date
-------------------------------------|--------------------------|-------------------|--------------------------|-------------------
550e8400-e29b-41d4-a716-446655440000 | johndoe@pettales.local   | 5                 | 5                        | 2025-02-01 00:00:00+00
```

**Step 2: Manually reset their credits**
```sql
SELECT admin_reset_user_credits('550e8400-e29b-41d4-a716-446655440000');
```

**Expected Output:**
```json
{
  "success": true,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "johndoe@pettales.local",
  "before": {
    "credits": 5,
    "reset_date": "2025-02-01T00:00:00Z"
  },
  "after": {
    "credits": 10,
    "reset_date": "2025-03-01T00:00:00Z"
  },
  "credits_granted": 5
}
```

**Step 3: Verify credit_ledger entry**
```sql
SELECT 
    user_id,
    delta,
    reason,
    metadata,
    created_at
FROM credit_ledger 
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000' 
AND reason = 'monthly_reset' 
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected Output:**
```
user_id                              | delta | reason        | metadata                                                  | created_at
-------------------------------------|-------|---------------|-----------------------------------------------------------|-------------------
550e8400-e29b-41d4-a716-446655440000 | 5     | monthly_reset | {"manual_reset": true, "admin_triggered": true, ...}      | 2025-01-15 10:30:00+00
```

**Step 4: Verify credit_reset_date advanced**
```sql
SELECT 
    id,
    credits_remaining,
    credit_reset_date
FROM users 
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

**Expected Output:**
```
id                                   | credits_remaining | credit_reset_date
-------------------------------------|-------------------|-------------------
550e8400-e29b-41d4-a716-446655440000 | 10                | 2025-03-01 00:00:00+00
```

✅ **Test passes if:**
- Credits increased by monthly_credit_allowance
- credit_reset_date advanced to 1st of next month
- credit_ledger has new entry with reason='monthly_reset'

---

## Test 4: Grace Overage Handling (Negative Balance)

**Purpose:** Verify system correctly handles users with negative balances

**Step 1: Temporarily give user negative balance**
```sql
UPDATE users 
SET credits_remaining = -10 
WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- Verify update
SELECT id, credits_remaining FROM users 
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

**Expected Output:**
```
id                                   | credits_remaining
-------------------------------------|-------------------
550e8400-e29b-41d4-a716-446655440000 | -10
```

**Step 2: Reset their credits**
```sql
SELECT admin_reset_user_credits('550e8400-e29b-41d4-a716-446655440000');
```

**Expected Output:**
```json
{
  "success": true,
  "before": {
    "credits": -10
  },
  "after": {
    "credits": -5
  },
  "credits_granted": 5
}
```

**Step 3: Verify new balance**
```sql
SELECT credits_remaining 
FROM users 
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

**Expected Output:**
```
credits_remaining
------------------
-5
```

✅ **Test passes if:**
- New balance = old balance + monthly_allowance
- Example: -10 + 5 = -5 (overage deducted from new allowance)
- This is correct behavior (user must pay off overage)

---

## Test 5: Idempotency (Running Twice Same Day)

**Purpose:** Verify reset cannot run twice on same day

**Step 1: Run full reset**
```sql
SELECT reset_monthly_credits();
```

**Expected Output:**
```json
{
  "success": true,
  "run_date": "2025-01-15",
  "users_processed": 10,
  "total_credits_granted": 50,
  "execution_time_ms": 234
}
```

**Step 2: Run again immediately**
```sql
SELECT reset_monthly_credits();
```

**Expected Output:**
```json
{
  "success": true,
  "message": "Reset already completed today",
  "run_date": "2025-01-15",
  "users_processed": 0,
  "total_credits_granted": 0
}
```

**Step 3: Verify only one log entry for today**
```sql
SELECT COUNT(*) as log_count
FROM credit_reset_logs 
WHERE run_date = CURRENT_DATE;
```

**Expected Output:**
```
log_count
----------
1
```

✅ **Test passes if:**
- Second run returns "already completed" message
- No duplicate credits granted
- Only one log entry exists for today

---

## Test 6: Verify Cron Job is Scheduled

**Purpose:** Confirm pg_cron job is properly scheduled

**SQL:**
```sql
SELECT 
    jobid,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active
FROM cron.job 
WHERE jobname = 'monthly-credit-reset';
```

**Expected Output:**
```
jobid | schedule  | command                        | nodename  | nodeport | database | username | active
------|-----------|--------------------------------|-----------|----------|----------|----------|-------
1     | 5 0 1 * * | SELECT reset_monthly_credits() | localhost | 5432     | postgres | postgres | true
```

✅ **Test passes if:**
- Job exists with jobname='monthly-credit-reset'
- Schedule is '5 0 1 * *' (00:05 UTC on 1st of month)
- Command is 'SELECT reset_monthly_credits()'
- active=true

---

## Test 7: Check Cron Job Run History

**Purpose:** View past cron job executions

**SQL:**
```sql
SELECT 
    runid,
    jobid,
    start_time,
    end_time,
    status,
    return_message,
    (end_time - start_time) as duration
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'monthly-credit-reset')
ORDER BY start_time DESC 
LIMIT 10;
```

**Expected Output (if job has run):**
```
runid | jobid | start_time          | end_time            | status    | return_message | duration
------|-------|---------------------|---------------------|-----------|----------------|----------
1     | 1     | 2025-01-01 00:05:00 | 2025-01-01 00:05:02 | succeeded | {"success": true, ...} | 00:00:02
```

**If no rows:**
- Job hasn't run yet (scheduled for 1st of next month)
- This is normal if testing before the 1st

---

## Test 8: Manually Trigger Cron Job (Don't Wait Until Next Month)

**Purpose:** Test the full reset without waiting for scheduled time

⚠️ **WARNING:** This will actually grant credits to all users due for reset. Only run in test/staging environment!

**SQL:**
```sql
SELECT reset_monthly_credits();
```

**Expected Output:**
```json
{
  "success": true,
  "run_date": "2025-01-15",
  "users_processed": 150,
  "total_credits_granted": 750,
  "execution_time_ms": 1234
}
```

**Verify Results:**
```sql
-- Check log entry
SELECT * FROM credit_reset_logs ORDER BY created_at DESC LIMIT 1;

-- Check users got credits
SELECT 
    COUNT(*) as users_with_reset,
    SUM(delta) as total_granted
FROM credit_ledger 
WHERE reason = 'monthly_reset' 
AND created_at >= CURRENT_DATE;
```

✅ **Test passes if:**
- All users due for reset received credits
- credit_reset_logs has new entry with status='success'
- credit_ledger has entries for all processed users

---

## Test 9: Check Users Due for Reset

**Purpose:** See how many users will be processed on next run

**SQL:**
```sql
SELECT 
    COUNT(*) as users_due_for_reset,
    SUM(monthly_credit_allowance) as total_credits_to_grant,
    MIN(credit_reset_date) as earliest_reset_date,
    MAX(credit_reset_date) as latest_reset_date
FROM users
WHERE credit_reset_date <= NOW();
```

**Example Output:**
```
users_due_for_reset | total_credits_to_grant | earliest_reset_date | latest_reset_date
--------------------|------------------------|---------------------|-------------------
0                   | 0                      | NULL                | NULL
```

**Interpretation:**
- 0 users = all users already reset (good!)
- >0 users = these users will be processed on next reset

---

## Test 10: Verify Reset Worked (After First Run)

**Purpose:** Confirm users received credits after reset

**SQL:**
```sql
SELECT 
    u.email,
    u.credits_remaining,
    u.monthly_credit_allowance,
    u.credit_reset_date,
    cl.delta as last_grant,
    cl.created_at as last_grant_time
FROM users u
LEFT JOIN credit_ledger cl ON cl.user_id = u.id AND cl.reason = 'monthly_reset'
WHERE cl.created_at >= NOW() - interval '2 days'
ORDER BY cl.created_at DESC
LIMIT 20;
```

**Expected Output:**
```
email                  | credits_remaining | monthly_credit_allowance | credit_reset_date   | last_grant | last_grant_time
-----------------------|-------------------|--------------------------|---------------------|------------|-------------------
johndoe@pettales.local | 30                | 25                       | 2025-02-01 00:00:00 | 25         | 2025-01-01 00:05:01
janedoe@pettales.local | 80                | 75                       | 2025-02-01 00:00:00 | 75         | 2025-01-01 00:05:01
```

✅ **Test passes if:**
- Users have credit_ledger entries with reason='monthly_reset'
- credit_reset_date is 1st of next month
- credits_remaining increased by monthly_credit_allowance

---

## Troubleshooting

### Issue: pg_cron extension not found

**Solution:**
1. Verify Supabase Pro plan is active
2. Contact Supabase support to enable pg_cron
3. Alternative: Use Edge Function approach (not covered here)

### Issue: Cron job not running

**Check 1: Is job scheduled?**
```sql
SELECT * FROM cron.job WHERE jobname = 'monthly-credit-reset';
```

**Check 2: Are there any errors?**
```sql
SELECT * FROM cron.job_run_details WHERE status = 'failed' ORDER BY start_time DESC;
```

**Check 3: Manually trigger to see error**
```sql
SELECT reset_monthly_credits();
```

### Issue: Reset ran but users didn't get credits

**Check 1: View reset log**
```sql
SELECT * FROM credit_reset_logs ORDER BY created_at DESC LIMIT 1;
```

**Check 2: Were users due for reset?**
```sql
SELECT COUNT(*) FROM users WHERE credit_reset_date <= NOW();
```

**Check 3: Check for errors in log**
```sql
SELECT * FROM credit_reset_logs WHERE status != 'success';
```

### Issue: Duplicate resets on same day

**This should be impossible due to UNIQUE constraint on run_date**

**Verify:**
```sql
SELECT run_date, COUNT(*) 
FROM credit_reset_logs 
GROUP BY run_date 
HAVING COUNT(*) > 1;
```

If duplicates exist, this is a bug. Contact support.

---

## Monitoring Checklist

After deployment, monitor these metrics:

- [ ] Cron job runs successfully on 1st of each month
- [ ] credit_reset_logs shows status='success'
- [ ] All users receive credits (users_processed matches expected count)
- [ ] No failed resets in credit_reset_logs
- [ ] Execution time is reasonable (<10 seconds for 10,000 users)
- [ ] credit_ledger has entries for all processed users
- [ ] No duplicate resets on same day

---

## Rollback Instructions

If you need to remove the monthly reset system:

```sql
-- 1. Unschedule the cron job
SELECT cron.unschedule('monthly-credit-reset');

-- 2. Drop functions
DROP FUNCTION IF EXISTS public.reset_monthly_credits();
DROP FUNCTION IF EXISTS public.admin_reset_user_credits(uuid);

-- 3. Drop logs table
DROP TABLE IF EXISTS public.credit_reset_logs CASCADE;

-- 4. Remove 'monthly_reset' from allowed reasons
ALTER TABLE public.credit_ledger DROP CONSTRAINT IF EXISTS credit_ledger_reason_check;
ALTER TABLE public.credit_ledger ADD CONSTRAINT credit_ledger_reason_check 
CHECK (reason IN ('welcome_bonus', 'daily_faucet', 'manual_topup', 'debit_for_entry', 'admin_adjustment', 'referral_bonus', 'subscription_renewal'));
```

---

## Next Steps

After Phase B is complete and tested:

1. **Phase C:** Create Stripe webhook handler (`/api/stripe/webhook`)
2. **Phase D:** Implement subscription checkout flow
3. **Phase E:** Add billing UI to `/dashboard/settings`
4. **Phase F:** Test end-to-end with Stripe test mode

---

## Support

If you encounter issues:
1. Check troubleshooting section above
2. Review Supabase logs for errors
3. Manually trigger reset to see detailed error messages
4. Contact Supabase support for pg_cron issues
