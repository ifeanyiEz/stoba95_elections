import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.PGSSL === "false"
      ? false
      : { rejectUnauthorized: false },
});
