-- Append-only log of church settings changes (US-11a, Stage 5d.2): who changed the time zone, service
-- weekday or branding, when, and the before/after values of only the settings that changed. Written in the
-- same transaction as the change. Rows are never edited or deleted: the triggers below abort any UPDATE or
-- DELETE.

CREATE TABLE settings_events (
  id          INTEGER PRIMARY KEY,
  before_json TEXT NOT NULL CHECK (json_valid(before_json)),  -- e.g. {"serviceWeekday": 0}
  after_json  TEXT NOT NULL CHECK (json_valid(after_json)),
  user_id     INTEGER NOT NULL,  -- internal users.id (US-03a); no FK, so the log outlives anything
  user_name   TEXT NOT NULL,
  session_id  TEXT,  -- random ID fixed at sign-in, kept when the session cookie renews
  tab_id      TEXT,  -- random ID per page load, sent by the browser (X-Tab-Id header)
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TRIGGER settings_events_no_update BEFORE UPDATE ON settings_events
BEGIN
  SELECT RAISE(ABORT, 'settings_events is append-only');
END;

CREATE TRIGGER settings_events_no_delete BEFORE DELETE ON settings_events
BEGIN
  SELECT RAISE(ABORT, 'settings_events is append-only');
END;
