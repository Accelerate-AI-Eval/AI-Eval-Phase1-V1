-- Add onboarding_link_sent_at to users for 1-day onboarding link expiry calculation.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS onboarding_link_sent_at timestamp;

COMMENT ON COLUMN users.onboarding_link_sent_at IS 'When the onboarding link was last sent; used with ONBOARDING_LINK_EXPIRY_DAYS (1) to show Expired in user management.';
