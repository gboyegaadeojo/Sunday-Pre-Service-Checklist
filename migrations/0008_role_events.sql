-- Append-only log of Admin and Director role changes (US-03, Stage 6): whose roles changed, who changed them,
-- when, and the before/after values of only the roles that changed. Written in the same transaction as the
-- change. Rows are never edited or deleted: the triggers below abort any UPDATE or DELETE.

CREATE TABLE role_events (
  id             INTEGER PRIMARY KEY,
  target_user_id INTEGER NOT NULL,  -- internal users.id (US-03a) of the person whose roles changed; no FK
  target_name    TEXT NOT NULL,     -- their name at the time
  before_json    TEXT NOT NULL CHECK (json_valid(before_json)),  -- e.g. {"isDirector": false}
  after_json     TEXT NOT NULL CHECK (json_valid(after_json)),
  user_id        INTEGER NOT NULL,  -- internal users.id of the Admin who made the change; no FK
  user_name      TEXT NOT NULL,
  session_id     TEXT,  -- random ID fixed at sign-in, kept when the session cookie renews
  tab_id         TEXT,  -- random ID per page load, sent by the browser (X-Tab-Id header)
  user_agent     TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TRIGGER role_events_no_update BEFORE UPDATE ON role_events
BEGIN
  SELECT RAISE(ABORT, 'role_events is append-only');
END;

CREATE TRIGGER role_events_no_delete BEFORE DELETE ON role_events
BEGIN
  SELECT RAISE(ABORT, 'role_events is append-only');
END;
