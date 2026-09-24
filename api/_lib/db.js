import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.warn("DATABASE_URL is not set — database calls will fail until it's configured in Vercel.");
}

// neon()'s tagged template resolves to an array of row objects directly
// (no `.rows` wrapper), unlike @vercel/postgres.
export const sql = neon(connectionString || "postgres://user:pass@localhost/placeholder");
