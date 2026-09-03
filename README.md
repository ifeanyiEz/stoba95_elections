# STOBA 95 Elections

Closed voting platform for STOBA 95 association members. See
[voting-platform-plan.md](voting-platform-plan.md) for decisions and architecture.

## Structure

- `server/` — Express + TypeScript API (auth, votes, turnout, admin), sessions
  stored in Postgres via `connect-pg-simple`.
- `client/` — React + TypeScript (Vite) voter-facing UI.
- `db/schema.sql` — Postgres schema (members, roles, nominees, votes, turnout, admins).

## Local setup

1. Create a Postgres database and copy `server/.env.example` to `server/.env`,
   filling in `DATABASE_URL` and a random `SESSION_SECRET`.
2. Load the schema:
   ```
   psql "$DATABASE_URL" -f db/schema.sql
   ```
3. Install and run the server:
   ```
   cd server
   npm install
   npm run dev
   ```
4. Copy `client/.env.example` to `client/.env` and install/run the client:
   ```
   cd client
   npm install
   npm run dev
   ```
5. Create at least one admin manually (no signup UI by design):
   ```sql
   INSERT INTO admins (admin_id, password_hash)
   VALUES ('admin', '<bcrypt hash>');
   ```

## Notes

- Ballot secrecy: `votes` rows carry no member reference; `turnout` only
  records whether a member voted per role, enforced one-per-role by its
  primary key `(member_id, role_id)`.
- Per-candidate results are only computed in `/api/admin/roles/:id/results`,
  and only once a role's `is_open` is false.
- Member roster and nominee loading (via `/api/admin/members/issue` and
  `/api/admin/roles/:id/nominees`) is still pending the finalized roster.
