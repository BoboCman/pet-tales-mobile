-- ============================================================================
-- ATOMIC CREDIT DEDUCTION FUNCTION
-- Prevents race conditions in credit deduction
-- ============================================================================

CREATE OR REPLACE FUNCTION deduct_credit_atomic(user_uuid UUID)
RETURNS TABLE(
  success BOOLEAN,
  new_free_credits INTEGER,
  new_purchased_credits INTEGER,
  total_remaining INTEGER,
  deducted_from TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_free INTEGER;
  current_purchased INTEGER;
BEGIN
  -- Lock the user row to prevent concurrent access
  SELECT free_credits, purchased_credits 
  INTO current_free, current_purchased
  FROM users
  WHERE id = user_uuid
  FOR UPDATE;
  
  -- Handle user not found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', user_uuid;
  END IF;
  
  -- Check if user has sufficient credits
  IF (COALESCE(current_free, 0) + COALESCE(current_purchased, 0)) < 1 THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      COALESCE(current_free, 0)::INTEGER,
      COALESCE(current_purchased, 0)::INTEGER,
      (COALESCE(current_free, 0) + COALESCE(current_purchased, 0))::INTEGER,
      'none'::TEXT;
    RETURN;
  END IF;
  
  -- Deduct from free credits first, then purchased
  IF COALESCE(current_free, 0) > 0 THEN
    UPDATE users 
    SET 
      free_credits = free_credits - 1,
      updated_at = NOW()
    WHERE id = user_uuid;
    
    RETURN QUERY SELECT 
      TRUE::BOOLEAN,
      (current_free - 1)::INTEGER,
      COALESCE(current_purchased, 0)::INTEGER,
      ((current_free - 1) + COALESCE(current_purchased, 0))::INTEGER,
      'free'::TEXT;
  ELSE
    UPDATE users 
    SET 
      purchased_credits = purchased_credits - 1,
      updated_at = NOW()
    WHERE id = user_uuid;
    
    RETURN QUERY SELECT 
      TRUE::BOOLEAN,
      0::INTEGER,
      (current_purchased - 1)::INTEGER,
      (current_purchased - 1)::INTEGER,
      'purchased'::TEXT;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION deduct_credit_atomic(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_credit_atomic(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION deduct_credit_atomic(UUID) TO anon;

-- Ensure index exists for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_id ON users(id);

-- Add comment
COMMENT ON FUNCTION deduct_credit_atomic IS 
'Atomically deduct one credit from user account using row-level locking to prevent race conditions.';
