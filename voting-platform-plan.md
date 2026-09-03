# STOBA 95 Elections — Voting Platform Plan

Last updated: 2026-09-02

## Goal
A closed voting platform for STOBA 95 association members: members vote for nominated members across several leadership roles, results are tallied and shown in (or near) real time. Target: live on Render within one week (by ~Sept 9, 2026).

## Decisions (locked)
1. **Voter authentication:** Member ID + PIN, issued in advance per member. Login requires both.
2. **Ballot secrecy:** Anonymous. Votes are not linked to the voter who cast them; a separate "has voted" flag per member/role tracks turnout only.
3. **Result visibility while voting is open:** Live turnout/participation counts only ("X of Y have voted"). Per-candidate tallies are hidden until voting closes, then revealed.
4. **Roster & nominees:** Both finalized and ready to hand over — member roster (for ID/PIN issuance) and nominees per role.

## Architecture
- **Backend:** Node.js/Express (or a single Next.js app — API routes + pages in one deployable).
- **Database:** Render-managed PostgreSQL.
  - `members` (member_id, name, pin_hash, contact)
  - `roles` (role_id, title)
  - `nominees` (nominee_id, role_id, member_id)
  - `votes` (vote_id, role_id, nominee_id, cast_at) — **no member reference**, to preserve secrecy
  - `turnout` (member_id, role_id, voted boolean) — separate table, only tracks whether a member has voted per role, not who they voted for
  - Unique constraint on `turnout(member_id, role_id)` blocks double voting at the DB level.
- **Real-time turnout:** polling (fetch every 3–5s) against the `turnout` table — simple, sufficient at this scale.
- **Result reveal:** tallies computed from `votes` only after an admin closes voting (or the scheduled close time passes); hidden from all voter-facing views until then.
- **Access:** Member ID + PIN login, session cookie for the voting flow.
- **Admin panel:** minimal protected view — manage roles/nominees, issue/reset PINs, open/close voting, view/export final tallies.
- **Hosting:** Render Web Service (Node) + Render PostgreSQL. Paid "starter" tiers recommended over free tier to avoid idle spin-down or the 30-day free-Postgres expiry during the live election window.

## Rough 7-day timeline
- Day 1: Repo, Render project, Postgres schema, PIN issuance for the roster. *(decisions now locked — this can start immediately)*
- Day 2–3: Auth (member ID + PIN) + voting API (submit vote into `votes`, flip `turnout`, one-vote enforcement via DB constraint).
- Day 3–4: Voter-facing UI (login → ballot per role → confirmation).
- Day 4–5: Live turnout page + admin panel (roles/nominees/PINs, open/close voting, tally reveal on close, export).
- Day 5–6: Testing — double-vote attempts, concurrent votes, tie scenarios, mobile check; security pass (rate limiting, HTTPS, input validation, PIN hashing).
- Day 6–7: Deploy, distribute member IDs/PINs, buffer day for issues.

## Status
Decisions locked. Ready to start building. Waiting on: the actual member roster (for PIN issuance) and finalized nominees-per-role list, to load into the schema.
