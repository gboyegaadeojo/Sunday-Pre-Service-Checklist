-- Reviewing new teams (Stage 7a, US-15, requirements v1.18): a team in the schedule source with no links shows as
-- "new" until an Admin either links it or marks it "Not a media team" (e.g. a worship band). The mark is set once per
-- team and stops the note; it can be undone. It's by the source's team ID, so a rename keeps it.

CREATE TABLE non_media_teams (
  source           TEXT NOT NULL,
  team_external_id TEXT NOT NULL,
  team_name        TEXT NOT NULL,  -- as named when marked, for display
  marked_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (source, team_external_id)
);

-- The mapping log gains a 'not_media' action (marking or unmarking a team). SQLite can't change a CHECK constraint in
-- place, so the table is rebuilt with every row kept. DROP TABLE removes the append-only triggers with the old table
-- (it doesn't fire them); they're recreated on the new one.
CREATE TABLE mapping_events_new (
  id                   INTEGER PRIMARY KEY,
  action               TEXT NOT NULL CHECK (action IN ('link', 'unlink', 'sees_all', 'service_type', 'not_media')),
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
