// Applies db/schema.sql to DATABASE_URL. Safe to run on every deploy —
// every statement in schema.sql is a CREATE ... IF NOT EXISTS.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
});

const schemaPath = path.join(__dirname, "..", "..", "db", "schema.sql");
const sql = fs.readFileSync(schemaPath, "utf8");

pool
  .query(sql)
  .then(() => {
    console.log("Schema applied.");
    return pool.end();
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
