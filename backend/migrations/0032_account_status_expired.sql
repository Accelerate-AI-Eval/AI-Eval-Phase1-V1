-- Add 'expired' to account_status enum for user management (invited users whose signup link expired).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'account_status' AND e.enumlabel = 'expired'
  ) THEN
    ALTER TYPE public.account_status ADD VALUE 'expired';
  END IF;
END
$$;
