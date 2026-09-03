import { Request, Response, NextFunction } from "express";
import { pool } from "../db";

export function requireMember(req: Request, res: Response, next: NextFunction) {
  if (!req.session.memberId) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
}

// Logged-in members who were later flagged ineligible (e.g. dues lapsed)
// can still log in and see turnout, but cannot view or cast a ballot.
export async function requireEligible(req: Request, res: Response, next: NextFunction) {
  if (!req.session.memberId) {
    return res.status(401).json({ error: "Not logged in" });
  }
  const { rows } = await pool.query(
    "SELECT is_eligible FROM members WHERE member_id = $1",
    [req.session.memberId]
  );
  if (!rows[0]?.is_eligible) {
    return res.status(403).json({ error: "You are not eligible to vote in this election" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.adminId) {
    return res.status(401).json({ error: "Admin login required" });
  }
  next();
}
