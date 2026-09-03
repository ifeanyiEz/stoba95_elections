-- STOBA 95 Elections — schema
-- Matches voting-platform-plan.md decisions: anonymous votes, separate turnout tracking.

CREATE TABLE IF NOT EXISTS members (
  member_id        TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  pin_hash         TEXT NOT NULL,
  contact          TEXT,
  is_eligible      BOOLEAN NOT NULL DEFAULT TRUE,
  eligibility_note TEXT
);

CREATE TABLE IF NOT EXISTS roles (
  role_id     SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  is_open     BOOLEAN NOT NULL DEFAULT FALSE,
  closes_at   TIMESTAMPTZ, -- scheduled end of the voting window; auto-closes past this time
  closed_at   TIMESTAMPTZ  -- when it actually closed (early, on schedule, or manually)
);

CREATE TABLE IF NOT EXISTS nominees (
  nominee_id  SERIAL PRIMARY KEY,
  role_id     INTEGER NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  member_id   TEXT NOT NULL REFERENCES members(member_id)
);

-- No member reference on votes — preserves ballot secrecy per plan decision #2.
CREATE TABLE IF NOT EXISTS votes (
  vote_id     SERIAL PRIMARY KEY,
  role_id     INTEGER NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  nominee_id  INTEGER NOT NULL REFERENCES nominees(nominee_id) ON DELETE CASCADE,
  cast_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tracks only whether a member voted per role — not who they voted for.
CREATE TABLE IF NOT EXISTS turnout (
  member_id   TEXT NOT NULL REFERENCES members(member_id),
  role_id     INTEGER NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  voted       BOOLEAN NOT NULL DEFAULT FALSE,
  voted_at    TIMESTAMPTZ,
  PRIMARY KEY (member_id, role_id)
);

CREATE TABLE IF NOT EXISTS admins (
  admin_id    TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nominees_role ON nominees(role_id);
CREATE INDEX IF NOT EXISTS idx_votes_role_nominee ON votes(role_id, nominee_id);
