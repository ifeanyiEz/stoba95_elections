// One-off: creates or resets an admin account. Run via Render's Shell tab:
//   node scripts/create-admin.js <adminId> <password>
require("dotenv").config();
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const [, , adminId, password] = process.argv;
if (!adminId || !password) {
  console.error("Usage: node scripts/create-admin.js <adminId> <password>");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
});

bcrypt
  .hash(password, 10)
  .then((hash) =>
    pool.query(
      `INSERT INTO admins (admin_id, password_hash) VALUES ($1, $2)
       ON CONFLICT (admin_id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [adminId, hash]
    )
  )
  .then(() => {
    console.log(`Admin '${adminId}' created/updated.`);
    return pool.end();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
