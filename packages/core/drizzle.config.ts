import { defineConfig } from "drizzle-kit";

// Used only by `drizzle-kit generate` (schema -> SQL migration files).
// Generation doesn't touch a database; the URL is a placeholder default that
// the local Docker Postgres also happens to satisfy.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://julius:julius@localhost:5432/julius",
  },
});
