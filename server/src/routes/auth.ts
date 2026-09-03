import { Router } from "express";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { pool } from "../db";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, try again later." },
});

router.post("/login", loginLimiter, async (req, res) => {
  const { memberId, pin } = req.body ?? {};
  if (!memberId || !pin) {
    return res.status(400).json({ error: "memberId and pin are required" });
  }

  const result = await pool.query(
    "SELECT member_id, pin_hash FROM members WHERE member_id = $1",
    [memberId]
  );
  const member = result.rows[0];
  if (!member) {
    return res.status(401).json({ error: "Invalid member ID or PIN" });
  }

  const ok = await bcrypt.compare(String(pin), member.pin_hash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid member ID or PIN" });
  }

  req.session.memberId = member.member_id;
  res.json({ ok: true, memberId: member.member_id });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", (req, res) => {
  if (!req.session.memberId) return res.status(401).json({ error: "Not logged in" });
  res.json({ memberId: req.session.memberId });
});

router.post("/admin/login", loginLimiter, async (req, res) => {
  const { adminId, password } = req.body ?? {};
  if (!adminId || !password) {
    return res.status(400).json({ error: "adminId and password are required" });
  }

  const result = await pool.query(
    "SELECT admin_id, password_hash FROM admins WHERE admin_id = $1",
    [adminId]
  );
  const admin = result.rows[0];
  if (!admin) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(String(password), admin.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  req.session.adminId = admin.admin_id;
  res.json({ ok: true, adminId: admin.admin_id });
});

router.post("/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

export default router;
