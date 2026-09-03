import { Router } from "express";
import { pool } from "../db";
import { requireMember } from "../middleware/auth";

const router = Router();

// Live turnout only — never per-candidate tallies (those stay in admin/results,
// gated on role.is_open = false). Poll this every few seconds from the client.
router.get("/", requireMember, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT r.role_id, r.title, r.is_open,
            (SELECT COUNT(*) FROM members WHERE is_eligible = TRUE) AS total_members,
            (SELECT COUNT(*)
               FROM turnout t
               JOIN members m ON m.member_id = t.member_id
               WHERE t.role_id = r.role_id AND t.voted = TRUE AND m.is_eligible = TRUE) AS voted_count
     FROM roles r
     ORDER BY r.role_id`
  );

  res.json({
    roles: rows.map((r) => ({
      roleId: r.role_id,
      title: r.title,
      isOpen: r.is_open,
      totalMembers: Number(r.total_members),
      votedCount: Number(r.voted_count),
    })),
  });
});

export default router;
