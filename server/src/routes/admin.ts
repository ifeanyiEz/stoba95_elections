import { Router } from "express";
import bcrypt from "bcrypt";
import { pool } from "../db";
import { requireAdmin } from "../middleware/auth";

const router = Router();
router.use(requireAdmin);

// --- Roles & nominees ---

router.get("/roles", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT role_id, title, is_open, closes_at, closed_at FROM roles ORDER BY role_id"
  );
  res.json({ roles: rows });
});

router.post("/roles", async (req, res) => {
  const { title } = req.body ?? {};
  if (!title) return res.status(400).json({ error: "title is required" });
  const { rows } = await pool.query(
    "INSERT INTO roles (title) VALUES ($1) RETURNING role_id, title, is_open",
    [title]
  );
  res.status(201).json({ role: rows[0] });
});

router.get("/roles/:roleId/nominees", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT n.nominee_id, n.member_id, m.name
     FROM nominees n
     JOIN members m ON m.member_id = n.member_id
     WHERE n.role_id = $1
     ORDER BY m.name`,
    [req.params.roleId]
  );
  res.json({ nominees: rows });
});

router.post("/roles/:roleId/nominees", async (req, res) => {
  const { roleId } = req.params;
  const { memberId } = req.body ?? {};
  if (!memberId) return res.status(400).json({ error: "memberId is required" });
  const { rows } = await pool.query(
    "INSERT INTO nominees (role_id, member_id) VALUES ($1, $2) RETURNING nominee_id, role_id, member_id",
    [roleId, memberId]
  );
  res.status(201).json({ nominee: rows[0] });
});

// Blocked once votes exist for this nominee — removing them would silently
// destroy cast (anonymous) ballots via the FK cascade.
router.delete("/roles/:roleId/nominees/:nomineeId", async (req, res) => {
  const { nomineeId, roleId } = req.params;
  const voteCount = await pool.query(
    "SELECT COUNT(*) FROM votes WHERE nominee_id = $1",
    [nomineeId]
  );
  if (Number(voteCount.rows[0].count) > 0) {
    return res.status(409).json({ error: "Cannot remove a nominee who has already received votes" });
  }
  const { rowCount } = await pool.query(
    "DELETE FROM nominees WHERE nominee_id = $1 AND role_id = $2",
    [nomineeId, roleId]
  );
  if (!rowCount) return res.status(404).json({ error: "Nominee not found" });
  res.json({ ok: true });
});

// closesAt (optional ISO timestamp) schedules the voting window's end; the
// role also auto-closes early if every eligible member votes before then.
router.post("/roles/:roleId/open", async (req, res) => {
  const { closesAt } = req.body ?? {};
  const { rows } = await pool.query(
    `UPDATE roles SET is_open = TRUE, closes_at = $2, closed_at = NULL
     WHERE role_id = $1
     RETURNING role_id, is_open, closes_at`,
    [req.params.roleId, closesAt ?? null]
  );
  if (!rows[0]) return res.status(404).json({ error: "Role not found" });
  res.json({ role: rows[0] });
});

router.post("/roles/:roleId/close", async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE roles SET is_open = FALSE, closed_at = now() WHERE role_id = $1 RETURNING role_id, is_open, closed_at",
    [req.params.roleId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Role not found" });
  res.json({ role: rows[0] });
});

// Tallies are only ever computed here, and only meaningful once is_open = false.
router.get("/roles/:roleId/results", async (req, res) => {
  const { roleId } = req.params;
  const role = await pool.query("SELECT is_open, title FROM roles WHERE role_id = $1", [roleId]);
  if (!role.rows[0]) return res.status(404).json({ error: "Role not found" });
  if (role.rows[0].is_open) {
    return res.status(400).json({ error: "Voting is still open for this role" });
  }

  const { rows } = await pool.query(
    `SELECT n.nominee_id, m.name AS nominee_name, COUNT(v.vote_id) AS votes
     FROM nominees n
     JOIN members m ON m.member_id = n.member_id
     LEFT JOIN votes v ON v.nominee_id = n.nominee_id
     WHERE n.role_id = $1
     GROUP BY n.nominee_id, m.name
     ORDER BY votes DESC`,
    [roleId]
  );

  res.json({
    roleId: Number(roleId),
    title: role.rows[0].title,
    results: rows.map((r) => ({ nomineeId: r.nominee_id, name: r.nominee_name, votes: Number(r.votes) })),
  });
});

// --- Members / PIN issuance ---

router.get("/members", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT member_id, name, contact, is_eligible, eligibility_note FROM members ORDER BY member_id"
  );
  res.json({ members: rows });
});

// Bulk-issue: [{ memberId, name, pin, contact, isEligible, eligibilityNote }]
router.post("/members/issue", async (req, res) => {
  const { members } = req.body ?? {};
  if (!Array.isArray(members) || members.length === 0) {
    return res.status(400).json({ error: "members array is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const m of members) {
      const pinHash = await bcrypt.hash(String(m.pin), 10);
      const isEligible = m.isEligible ?? true;
      await client.query(
        `INSERT INTO members (member_id, name, pin_hash, contact, is_eligible, eligibility_note)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (member_id) DO UPDATE SET
           name = EXCLUDED.name,
           contact = EXCLUDED.contact,
           is_eligible = EXCLUDED.is_eligible,
           eligibility_note = EXCLUDED.eligibility_note`,
        [m.memberId, m.name, pinHash, m.contact ?? null, isEligible, m.eligibilityNote ?? null]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true, count: members.length });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// Flag or clear a member's voting eligibility (e.g. dues lapsed, membership
// not in good standing). Does not affect login — only the ballot/turnout.
router.post("/members/:memberId/eligibility", async (req, res) => {
  const { isEligible, note } = req.body ?? {};
  if (typeof isEligible !== "boolean") {
    return res.status(400).json({ error: "isEligible (boolean) is required" });
  }
  const { rows } = await pool.query(
    `UPDATE members SET is_eligible = $1, eligibility_note = $2
     WHERE member_id = $3
     RETURNING member_id, is_eligible, eligibility_note`,
    [isEligible, note ?? null, req.params.memberId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Member not found" });
  res.json({ member: rows[0] });
});

router.post("/members/:memberId/reset-pin", async (req, res) => {
  const { pin } = req.body ?? {};
  if (!pin) return res.status(400).json({ error: "pin is required" });
  const pinHash = await bcrypt.hash(String(pin), 10);
  const { rows } = await pool.query(
    "UPDATE members SET pin_hash = $1 WHERE member_id = $2 RETURNING member_id",
    [pinHash, req.params.memberId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Member not found" });
  res.json({ ok: true });
});

// --- Account ---

// Self-service password change for the logged-in admin. Requires the
// current password so a stray/hijacked session can't lock out the real
// admin — there's no Shell access on the free plan to fix that by hand.
router.post("/account/change-password", async (req, res) => {
  const adminId = req.session.adminId!;
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const { rows } = await pool.query(
    "SELECT password_hash FROM admins WHERE admin_id = $1",
    [adminId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Admin not found" });

  const ok = await bcrypt.compare(String(currentPassword), rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

  const newHash = await bcrypt.hash(String(newPassword), 10);
  await pool.query("UPDATE admins SET password_hash = $1 WHERE admin_id = $2", [newHash, adminId]);
  res.json({ ok: true });
});

export default router;
