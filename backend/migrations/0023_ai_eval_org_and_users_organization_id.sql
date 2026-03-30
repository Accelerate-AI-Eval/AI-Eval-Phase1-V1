-- Add AI EVAL organization at id 1 and switch users table to organization_id

-- 1. Ensure AI EVAL organization exists at id 1
INSERT INTO public.organizations (id, "organizationName", "organizationStatus", created_at, created_by)
VALUES (1, 'ai eval', 'active', now(), 'system')
ON CONFLICT (id) DO UPDATE SET "organizationName" = 'ai eval', "organizationStatus" = 'active';

-- Set sequence so next org gets id >= 2
SELECT setval(pg_get_serial_sequence('public.organizations', 'id'), (SELECT COALESCE(MAX(id), 1) FROM public.organizations));

-- 2. Add organization_id column to users (nullable first for backfill)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS organization_id integer REFERENCES public.organizations(id);

-- 3. Backfill and drop organization_name only if that column exists (existing DBs)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'organization_name') THEN
    UPDATE public.users u SET organization_id = o.id FROM public.organizations o WHERE u.organization_id IS NULL AND lower(trim(o."organizationName")) = lower(trim(u.organization_name));
    UPDATE public.users SET organization_id = 1 WHERE organization_id IS NULL AND lower(trim(organization_name)) IN ('ai eval', 'ai eval ');
    UPDATE public.users SET organization_id = 1 WHERE organization_id IS NULL;
    ALTER TABLE public.users DROP COLUMN organization_name;
  END IF;
END $$;

-- 4. Ensure organization_id is NOT NULL (idempotent)
ALTER TABLE public.users ALTER COLUMN organization_id SET NOT NULL;
