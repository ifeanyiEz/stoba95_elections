import { Pool, PoolClient } from "pg";

// Lazy expiry sweep — no scheduler in this app, so any request that touches
// roles first closes out anything past its scheduled window.
export async function closeExpiredRoles(pool: Pool) {
  await pool.query(
    `UPDATE roles SET is_open = FALSE, closed_at = now()
     WHERE is_open = TRUE AND closes_at IS NOT NULL AND closes_at <= now()`
  );
}

// Closes a role early once every eligible member has voted in it, regardless
// of the scheduled window. Must run in the same transaction as the vote/turnout
// insert it follows, so the count it sees includes the vote just cast.
export async function closeIfFullyVoted(client: PoolClient, roleId: number) {
  await client.query(
    `UPDATE roles SET is_open = FALSE, closed_at = now()
     WHERE role_id = $1
       AND is_open = TRUE
       AND (SELECT COUNT(*) FROM members WHERE is_eligible = TRUE) > 0
       AND (SELECT COUNT(*) FROM members WHERE is_eligible = TRUE) <= (
         SELECT COUNT(*)
         FROM turnout t
         JOIN members m ON m.member_id = t.member_id
         WHERE t.role_id = $1 AND t.voted = TRUE AND m.is_eligible = TRUE
       )`,
    [roleId]
  );
}
