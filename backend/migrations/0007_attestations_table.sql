-- Attestation table: id, status (DRAFT | COMPLETED), formData (jsonb), createdAt, updatedAt
CREATE TABLE IF NOT EXISTS "attestations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" integer NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'DRAFT',
  "form_data" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
