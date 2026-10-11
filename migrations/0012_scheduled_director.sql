-- Scheduled Director (Stage 12, requirements C41): an Admin marks positions whose scheduled people get the Director
-- role for the current service period. Roles never come from the schedule source on their own; only positions an
-- Admin marks grant it, and only Director (never Admin).

-- The switch, on a position's own link ("Gets the Director role while scheduled"). Kept by the source's IDs like the
-- link itself, so renaming the position keeps it.
ALTER TABLE team_links ADD COLUMN grants_director INTEGER NOT NULL DEFAULT 0 CHECK (grants_director IN (0, 1));

-- Grants: one open row per person and service while they're scheduled in a marked position. A grant counts only
-- while its service is the current one, so it ends by itself when the next service becomes current; ended_at is set
-- (and the end logged in role_events) when the app next checks the schedule, or sooner if they're taken off the plan.
-- Deleted with its service (tests clean services; live services are never deleted).
CREATE TABLE scheduled_directors (
  id                   INTEGER PRIMARY KEY,
  service_id           INTEGER NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  user_id              INTEGER NOT NULL REFERENCES users (id),  -- internal users.id (US-03a)
  source               TEXT NOT NULL,                           -- schedule source name, e.g. 'planning_center'
  team_external_id     TEXT NOT NULL,
  position_external_id TEXT NOT NULL,
  position_name        TEXT NOT NULL,                           -- "Team › Position" as named when granted
  granted_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ended_at             TEXT
);
CREATE UNIQUE INDEX scheduled_directors_open ON scheduled_directors (service_id, user_id) WHERE ended_at IS NULL;
CREATE INDEX scheduled_directors_user ON scheduled_directors (user_id) WHERE ended_at IS NULL;

-- The mapping log gains a 'director' action (the switch turned on or off). SQLite can't change a CHECK constraint in
-- place, so the table is rebuilt with every row kept, as in 0011. DROP TABLE removes the append-only triggers with the
-- old table (it doesn't fire them); they're recreated on the new one.
CREATE TABLE mapping_events_new (
  id                   INTEGER PRIMARY KEY,
  action               TEXT NOT NULL CHECK (action IN ('link', 'unlink', 'sees_all', 'service_type', 'not_media', 'director')),
  source               TEXT NOT NULL,
  team_external_id     TEXT,
  position_external_id TEXT,
  target_name          TEXT NOT NULL,
  before_json          TEXT CHECK (before_json IS NULL OR json_valid(before_json)),
  after_json           TEXT CHECK (after_json IS NULL OR json_valid(after_json)),
  user_id              INTEGER NOT NULL,
  user_name            TEXT NOT NULL,
  session_id           TEXT,
  tab_id               TEXT,
  user_agent           TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO mapping_events_new SELECT * FROM mapping_events;
DROP TABLE mapping_events;
ALTER TABLE mapping_events_new RENAME TO mapping_events;

CREATE TRIGGER mapping_events_no_update BEFORE UPDATE ON mapping_events
BEGIN
  SELECT RAISE(ABORT, 'mapping_events is append-only');
END;

CREATE TRIGGER mapping_events_no_delete BEFORE DELETE ON mapping_events
BEGIN
  SELECT RAISE(ABORT, 'mapping_events is append-only');
END;
