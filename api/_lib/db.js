import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.warn("DATABASE_URL is not set — database calls will fail until it's configured in Vercel.");
}

// neon()'s tagged template resolves to an array of row objects directly
// (no `.rows` wrapper), unlike @vercel/postgres.
export const sql = neon(connectionString || "postgres://user:pass@localhost/placeholder");

// There's no migration step in the deploy, so the endpoints that need the
// questionnaire schema apply db/schema.sql's idempotent additions themselves,
// once per warm function instance.
let schemaReady = null;
export function ensureSchema() {
  schemaReady ??= (async () => {
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS questionnaire_token text UNIQUE`;
    await sql`
      CREATE TABLE IF NOT EXISTS questionnaires (
        id bigserial PRIMARY KEY,
        booking_id bigint NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE CASCADE,
        owner_name text NOT NULL,
        owner_phone text NOT NULL,
        owner_email text NOT NULL,
        emergency_name text NOT NULL,
        emergency_phone text NOT NULL,
        dog_name text NOT NULL,
        breed text NOT NULL,
        age text NOT NULL,
        weight text NOT NULL,
        vet_name text NOT NULL,
        vet_address text NOT NULL,
        vet_phone text NOT NULL,
        health_notes text,
        behavior_notes text,
        pickup_address text NOT NULL,
        pickup_time text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    // Billing address was dropped from the form, pickup time added.
    await sql`ALTER TABLE questionnaires DROP COLUMN IF EXISTS billing_address`;
    await sql`ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS pickup_time text`;
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}
