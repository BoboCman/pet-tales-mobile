# Credits System Documentation

## Overview

The Pet Tales credits system provides a secure, auditable way to track and manage user credits for video processing. Credits are consumed based on video duration and can be granted through various mechanisms.

## Credit Math

- **Calculation**: `ceil(duration_seconds / 60)` with minimum 1 credit
- **Examples**:
  - 30 seconds = 1 credit
  - 60 seconds = 1 credit  
  - 90 seconds = 2 credits
  - 120 seconds = 2 credits

## Core Functions

### `grant_credits(amount, reason, entry_id?, metadata?)`
**Access**: Service role only  
**Purpose**: Add credits to authenticated user's account

**When called**:
- Welcome bonus for new users
- Daily faucet rewards
- Manual top-ups by admins
- Administrative adjustments

**Example**:
```sql
SELECT grant_credits(5, 'welcome_bonus');
```

### `debit_credits_for_entry(entry_id)`
**Access**: Service role only  
**Purpose**: Deduct credits based on video duration

**When called**:
- After video duration is determined in Cloudinary webhook
- Automatically calculates credits based on duration
- Includes idempotency protection against double-charging

**Example**:
```sql
SELECT debit_credits_for_entry('entry-uuid-here');
```

### `get_credit_balance(target_user?)`
**Access**: Authenticated users (own balance), Service role (any user)  
**Purpose**: Retrieve current credit balance

**Usage**:
```sql
-- User checking own balance
SELECT get_credit_balance();

-- Service role checking any user's balance  
SELECT get_credit_balance('user-uuid-here');
```

## Database Tables

### `credit_ledger`
Auditable transaction log for all credit changes.

**Key fields**:
- `user_id`: Owner of the credits
- `delta`: Credit change (positive for grants, negative for debits)
- `reason`: Transaction type (welcome_bonus, debit_for_entry, etc.)
- `entry_id`: Associated diary entry (for debits)
- `metadata`: Additional context (duration, source, etc.)

**Security**: Row-level security allows users to view only their own transactions.

### `users.credits_remaining`
Current credit balance for each user.
- **Type**: `integer NOT NULL DEFAULT 0`
- **Updated**: Automatically by grant/debit functions

### `diary_entries.credits_debited`
Idempotency flag to prevent double-charging.
- **Type**: `boolean DEFAULT false`
- **Purpose**: Ensures each entry is charged exactly once

## Security Features

1. **Function-level access control**: All credit functions restricted to appropriate roles
2. **Atomic operations**: Race condition protection for concurrent webhook calls
3. **Idempotency protection**: Unique constraints prevent duplicate charges
4. **Input validation**: Constraints on amounts, reasons, and user access
5. **Audit trail**: Complete transaction history in credit_ledger

## Viewing Transactions

Users can query their credit history:

```sql
SELECT delta, reason, created_at, metadata
FROM credit_ledger 
WHERE user_id = auth.uid()
ORDER BY created_at DESC;
```

Service roles can access any user's transactions for support purposes.
