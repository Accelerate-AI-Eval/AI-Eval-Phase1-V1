-- Fix organizations id sequence when it is behind the current max(id).
-- Error: duplicate key value violates unique constraint "organizations_pkey"
-- happens when the sequence returns an id that already exists (e.g. after
-- manual inserts or data restore). This sets the sequence to max(id).
SELECT setval(
  pg_get_serial_sequence('organizations', 'id'),
  COALESCE((SELECT MAX(id) FROM organizations), 1)
);
