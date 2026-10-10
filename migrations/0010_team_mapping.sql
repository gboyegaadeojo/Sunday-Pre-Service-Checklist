-- Team mapping (Stage 7a, US-15): which schedule-source teams and positions belong to which checklist department.
-- Links already live in team_links (0001), keyed by the source's IDs, so renames in the source don't break them.

-- People scheduled in a team or position marked "sees all departments" (e.g. Technical Director) see every
-- department by default (US-05). Set by an Admin; never automatic.
ALTER TABLE team_links ADD COLUMN sees_all INTEGER NOT NULL DEFAULT 0 CHECK (sees_all IN (0, 1));

-- Append-only log of mapping changes: linking, unlinking, "sees all departments", and the Service Type the app
-- follows. Same pattern as the other logs: written in the same transaction as the change, never edited or deleted.
CREATE TABLE mapping_events (
  id                   INTEGER PRIMARY KEY,
  action               TEXT NOT NULL CHECK (action IN ('link', 'unlink', 'sees_all', 'service_type')),
  source               TEXT NOT NULL,  -- schedule source name, e.g. 'planning_center'
  team_external_id     TEXT,           -- NULL for a Service Type change
  position_external_id TEXT,           -- NULL for a team-level link
  target_name          TEXT NOT NULL,  -- "Team › Position", or the Service Type, as named at the time
  before_json          TEXT CHECK (before_json IS NULL OR json_valid(before_json)),  -- e.g. {"department": {"id": 4, "name": "Audio"}}
  after_json           TEXT CHECK (after_json IS NULL OR json_valid(after_json)),
  user_id              INTEGER NOT NULL,  -- internal users.id (US-03a); no FK, so the log outlives anything
  user_name            TEXT NOT NULL,
  session_id           TEXT,
  tab_id               TEXT,
  user_agent           TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TRIGGER mapping_events_no_update BEFORE UPDATE ON mapping_events
BEGIN
  SELECT RAISE(ABORT, 'mapping_events is append-only');
END;

CREATE TRIGGER mapping_events_no_delete BEFORE DELETE ON mapping_events
BEGIN
  SELECT RAISE(ABORT, 'mapping_events is append-only');
END;

-- Local development only: adjustments to the fake schedule source (positions added, renamed or removed, and
-- whether it's "down"), so they survive dev-server restarts. Production code never reads or writes it.
CREATE TABLE dev_state (
  key  TEXT PRIMARY KEY,
  json TEXT NOT NULL CHECK (json_valid(json))
);
