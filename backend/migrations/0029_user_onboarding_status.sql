-- Add onboarding_status enum and column to users table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'onboarding_status') THEN
    CREATE TYPE public.onboarding_status AS ENUM('completed', 'expired', 'pending');
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_status public.onboarding_status NOT NULL DEFAULT 'pending';

-- Completed: user has completed onboarding (user_onboarding_completed = true)
UPDATE public.users
SET onboarding_status = 'completed'
WHERE user_onboarding_completed = 'true';

-- Expired: still invited but invite/signup token link has expired (invite link is 7d)
UPDATE public.users
SET onboarding_status = 'expired'
WHERE account_status = 'invited'
  AND invited_at IS NOT NULL
  AND invited_at + INTERVAL '7 days' < now();

-- Remaining invited users (within 7 days) stay pending; confirmed users already set above or stay completed
