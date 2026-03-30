-- Sectors and industries lookup tables (aligned with frontend INDUSTRY_SECTORS / BUYER_INDUSTRY_SECTORS)
-- Only create/seed if schema uses "id" column; skip when sectors has industry_id (bootstrap schema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sectors') THEN
    CREATE TABLE "sectors" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" varchar(100) NOT NULL,
      "sort_order" integer NOT NULL DEFAULT 0,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE "industries" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "sector_id" uuid NOT NULL REFERENCES "sectors"("id") ON DELETE CASCADE,
      "name" varchar(200) NOT NULL,
      "sort_order" integer NOT NULL DEFAULT 0,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      UNIQUE("sector_id", "name")
    );
    INSERT INTO "sectors" ("id", "name", "sort_order") VALUES
      ('a0000001-0001-4000-8000-000000000001', 'Public Sector', 1),
      ('a0000001-0001-4000-8000-000000000002', 'Private Sector', 2),
      ('a0000001-0001-4000-8000-000000000003', 'Non-Profit', 3);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sectors' AND column_name = 'id') THEN
    CREATE TABLE IF NOT EXISTS "industries" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "sector_id" uuid NOT NULL REFERENCES "sectors"("id") ON DELETE CASCADE,
      "name" varchar(200) NOT NULL,
      "sort_order" integer NOT NULL DEFAULT 0,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      UNIQUE("sector_id", "name")
    );
    INSERT INTO "sectors" ("id", "name", "sort_order") VALUES
      ('a0000001-0001-4000-8000-000000000001', 'Public Sector', 1),
      ('a0000001-0001-4000-8000-000000000002', 'Private Sector', 2),
      ('a0000001-0001-4000-8000-000000000003', 'Non-Profit', 3)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Seed industries only if table has sector_id (uuid structure). Skip when DB uses Excel structure (industry_sector_id/sector_name).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'industries' AND column_name = 'sector_id') THEN
    -- Seed industries under Public Sector
    INSERT INTO "industries" ("sector_id", "name", "sort_order") VALUES
      ('a0000001-0001-4000-8000-000000000001', 'Federal Government (US)', 1),
      ('a0000001-0001-4000-8000-000000000001', 'State Government (US)', 2),
      ('a0000001-0001-4000-8000-000000000001', 'Local Government (US)', 3),
      ('a0000001-0001-4000-8000-000000000001', 'International Governments', 4),
      ('a0000001-0001-4000-8000-000000000001', 'Educational Institutions (Public)', 5),
      ('a0000001-0001-4000-8000-000000000001', 'Public Healthcare Systems', 6),
      ('a0000001-0001-4000-8000-000000000001', 'Public Utilities', 7),
      ('a0000001-0001-4000-8000-000000000001', 'Defense & Military', 8),
      ('a0000001-0001-4000-8000-000000000001', 'Law Enforcement & Emergency Services', 9)
    ON CONFLICT (sector_id, name) DO NOTHING;

    -- Seed industries under Private Sector
    INSERT INTO "industries" ("sector_id", "name", "sort_order") VALUES
      ('a0000001-0001-4000-8000-000000000002', 'Healthcare', 1),
      ('a0000001-0001-4000-8000-000000000002', 'Finance & Banking', 2),
      ('a0000001-0001-4000-8000-000000000002', 'Insurance', 3),
      ('a0000001-0001-4000-8000-000000000002', 'GovTech', 4),
      ('a0000001-0001-4000-8000-000000000002', 'Manufacturing', 5),
      ('a0000001-0001-4000-8000-000000000002', 'Retail & E-commerce', 6),
      ('a0000001-0001-4000-8000-000000000002', 'Technology & Software', 7),
      ('a0000001-0001-4000-8000-000000000002', 'Telecommunications', 8),
      ('a0000001-0001-4000-8000-000000000002', 'Energy & Utilities', 9),
      ('a0000001-0001-4000-8000-000000000002', 'Transportation & Logistics', 10),
      ('a0000001-0001-4000-8000-000000000002', 'Real Estate & Construction', 11),
      ('a0000001-0001-4000-8000-000000000002', 'Professional Services', 12),
      ('a0000001-0001-4000-8000-000000000002', 'Media & Entertainment', 13),
      ('a0000001-0001-4000-8000-000000000002', 'Hospitality & Tourism', 14),
      ('a0000001-0001-4000-8000-000000000002', 'Agriculture & Food Production', 15),
      ('a0000001-0001-4000-8000-000000000002', 'Pharmaceuticals & Biotechnology', 16),
      ('a0000001-0001-4000-8000-000000000002', 'Automotive', 17),
      ('a0000001-0001-4000-8000-000000000002', 'Aerospace & Defense (Private)', 18),
      ('a0000001-0001-4000-8000-000000000002', 'Chemical & Materials', 19),
      ('a0000001-0001-4000-8000-000000000002', 'Consumer Goods', 20),
      ('a0000001-0001-4000-8000-000000000002', 'Unknown', 21)
    ON CONFLICT (sector_id, name) DO NOTHING;

    -- Seed industries under Non-Profit
    INSERT INTO "industries" ("sector_id", "name", "sort_order") VALUES
      ('a0000001-0001-4000-8000-000000000003', 'Educational Institutions (Non-Profit)', 1),
      ('a0000001-0001-4000-8000-000000000003', 'Healthcare (Non-Profit)', 2),
      ('a0000001-0001-4000-8000-000000000003', 'Social Services', 3),
      ('a0000001-0001-4000-8000-000000000003', 'Arts & Culture', 4),
      ('a0000001-0001-4000-8000-000000000003', 'Environmental & Conservation', 5),
      ('a0000001-0001-4000-8000-000000000003', 'International Development & Relief', 6),
      ('a0000001-0001-4000-8000-000000000003', 'Advocacy & Civil Rights', 7),
      ('a0000001-0001-4000-8000-000000000003', 'Religious Organizations', 8),
      ('a0000001-0001-4000-8000-000000000003', 'Research & Think Tanks', 9),
      ('a0000001-0001-4000-8000-000000000003', 'Foundations & Grantmaking', 10),
      ('a0000001-0001-4000-8000-000000000003', 'Community Development', 11)
    ON CONFLICT (sector_id, name) DO NOTHING;
  END IF;
END $$;
