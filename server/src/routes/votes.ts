import { Router } from "express";
import { pool } from "../db";
import { requireMember, requireEligible } from "../middleware/auth";
import { closeIfFullyVoted } from "../lib/roleClosing";

const router = Router();

// Ballot: open roles this member hasn't voted in yet, with their nominees.
router.get("/ballot", requireMember, requireEligible, async (req, res) => {
  const memberId = req.session.memberId!;

  const { rows } = await pool.query(
    `SELECT r.role_id, r.title,
            n.nominee_id, m.name AS nominee_name
     FROM roles r
     JOIN nominees n ON n.role_id = r.role_id
     JOIN members m ON m.member_id = n.member_id
     WHERE r.is_open = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM turnout t
         WHERE t.member_id = $1 AND t.role_id = r.role_id AND t.voted = TRUE
       )
     ORDER BY r.role_id, n.nominee_id`,
    [memberId]
  );

  const roles = new Map<number, { role_id: number; title: string; nominees: { nominee_id: number; name: string }[] }>();
  for (const row of rows) {
    if (!roles.has(row.role_id)) {
      roles.set(row.role_id, { role_id: row.role_id, title: row.title, nominees: [] });
    }
    roles.get(row.role_id)!.nominees.push({ nominee_id: row.nominee_id, name: row.nominee_name });
  }

  res.json({ roles: Array.from(roles.values()) });
});

// Cast a vote for one role. One-vote enforcement relies on the turnout
// table's (member_id, role_id) primary key — see db/schema.sql.
router.post("/", requireMember, requireEligible, async (req, res) => {
  const memberId = req.session.memberId!;
  const { roleId, nomineeId } = req.body ?? {};

  if (!roleId || !nomineeId) {
    return res.status(400).json({ error: "roleId and nomineeId are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const role = await client.query(
      "SELECT is_open FROM roles WHERE role_id = $1 FOR UPDATE",
      [roleId]
    );
    if (!role.rows[0] || !role.rows[0].is_open) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Voting is not open for this role" });
    }

    const nominee = await client.query(
      "SELECT nominee_id FROM nominees WHERE nominee_id = $1 AND role_id = $2",
      [nomineeId, roleId]
    );
    if (!nominee.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Nominee does not belong to this role" });
    }

    // Reserve the turnout slot first; conflict means they already voted.
    const turnout = await client.query(
      `INSERT INTO turnout (member_id, role_id, voted, voted_at)
       VALUES ($1, $2, TRUE, now())
       ON CONFLICT (member_id, role_id) DO NOTHING
       RETURNING member_id`,
      [memberId, roleId]
    );
    if (turnout.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "You have already voted for this role" });
    }

    await client.query(
      "INSERT INTO votes (role_id, nominee_id) VALUES ($1, $2)",
      [roleId, nomineeId]
    );

    // Every eligible member has now voted for this role — close it early
    // rather than waiting out the rest of the scheduled window.
    await closeIfFullyVoted(client, roleId);

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

export default router;
