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
        billing_address text NOT NULL,
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
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `;
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}
