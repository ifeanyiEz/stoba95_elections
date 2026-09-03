import { Router } from "express";
import { pool } from "../db";
import { requireMember } from "../middleware/auth";

const router = Router();

// Per-candidate tallies for roles that have closed — hidden for any role
// still open, per the plan's result-reveal rule. Any logged-in member can
// view once revealed (this is the "reveal" step, not the ballot).
router.get("/", requireMember, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT n.role_id, r.title AS role_title, r.closed_at,
            n.nominee_id, m.name AS nominee_name, COUNT(v.vote_id) AS votes
     FROM roles r
     JOIN nominees n ON n.role_id = r.role_id
     JOIN members m ON m.member_id = n.member_id
     LEFT JOIN votes v ON v.nominee_id = n.nominee_id
     WHERE r.is_open = FALSE AND r.closed_at IS NOT NULL
     GROUP BY n.role_id, r.title, r.closed_at, n.nominee_id, m.name
     ORDER BY n.role_id, votes DESC`
  );

  const roles = new Map<
    number,
    { roleId: number; title: string; closedAt: string; results: { nomineeId: number; name: string; votes: number }[] }
  >();
  for (const row of rows) {
    if (!roles.has(row.role_id)) {
      roles.set(row.role_id, {
        roleId: row.role_id,
        title: row.role_title,
        closedAt: row.closed_at,
        results: [],
      });
    }
    roles.get(row.role_id)!.results.push({
      nomineeId: row.nominee_id,
      name: row.nominee_name,
      votes: Number(row.votes),
    });
  }

  res.json({ roles: Array.from(roles.values()) });
});

export default router;
