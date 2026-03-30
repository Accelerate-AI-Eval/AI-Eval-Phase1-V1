-- Ensure industries (and sectors) exist in public schema so DB clients can find them.
-- Run this if you get "The specified object could not be found" when opening industries.
-- Safe to run multiple times (CREATE IF NOT EXISTS, ON CONFLICT DO NOTHING).

-- 1. Sectors (parent)
CREATE TABLE IF NOT EXISTS public.sectors (
  industry_id   integer PRIMARY KEY NOT NULL,
  industry_name varchar(100) NOT NULL
);

-- 2. Industries (child; references sectors)
CREATE TABLE IF NOT EXISTS public.industries (
  industry_sector_id integer PRIMARY KEY NOT NULL,
  industry_id        integer NOT NULL REFERENCES public.sectors(industry_id) ON DELETE CASCADE,
  sector_name        varchar(200) NOT NULL
);

-- Seed sectors
INSERT INTO public.sectors (industry_id, industry_name) VALUES
  (1, 'public'),
  (2, 'private'),
  (3, 'non-profit')
ON CONFLICT (industry_id) DO NOTHING;

-- Seed industries
INSERT INTO public.industries (industry_sector_id, industry_id, sector_name) VALUES
  (1, 1, 'Federal Government (US)'),
  (2, 1, 'State Government (US)'),
  (3, 1, 'Local Government (US)'),
  (4, 1, 'International Governments'),
  (5, 1, 'Educational Institutions (Public)'),
  (6, 1, 'Public Healthcare Systems'),
  (7, 1, 'Public Utilities'),
  (8, 1, 'Defense & Military'),
  (9, 1, 'Law Enforcement & Emergency Services'),
  (10, 2, 'Healthcare'),
  (11, 2, 'Finance & Banking'),
  (12, 2, 'Insurance'),
  (13, 2, 'GovTech'),
  (14, 2, 'Manufacturing'),
  (15, 2, 'Retail & E-commerce'),
  (16, 2, 'Technology & Software'),
  (17, 2, 'Telecommunications'),
  (18, 2, 'Energy & Utilities'),
  (19, 2, 'Transportation & Logistics'),
  (20, 2, 'Real Estate & Construction'),
  (21, 2, 'Professional Services'),
  (22, 2, 'Media & Entertainment'),
  (23, 2, 'Hospitality & Tourism'),
  (24, 2, 'Agriculture & Food Production'),
  (25, 2, 'Pharmaceuticals & Biotechnology'),
  (26, 2, 'Automotive'),
  (27, 2, 'Aerospace & Defense (Private)'),
  (28, 2, 'Chemical & Materials'),
  (29, 2, 'Consumer Goods'),
  (30, 2, 'Unknown'),
  (31, 3, 'Educational Institutions (Non-Profit)'),
  (32, 3, 'Healthcare (Non-Profit)'),
  (33, 3, 'Social Services'),
  (34, 3, 'Arts & Culture'),
  (35, 3, 'Environmental & Conservation'),
  (36, 3, 'International Development & Relief'),
  (37, 3, 'Advocacy & Civil Rights'),
  (38, 3, 'Religious Organizations'),
  (39, 3, 'Research & Think Tanks'),
  (40, 3, 'Foundations & Grantmaking'),
  (41, 3, 'Foundations & Grantmaking'),
  (42, 3, 'Community Development')
ON CONFLICT (industry_sector_id) DO NOTHING;
