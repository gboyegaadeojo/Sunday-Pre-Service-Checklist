-- Append-only activity log of every check, uncheck, reset and undo attempt (safety net for audits
-- and for investigating unexpected check-offs). Rows are never edited or deleted: the triggers below
-- abort any UPDATE or DELETE. No foreign keys, so the log outlives anything it refers to.

CREATE TABLE checkoff_events (
  id          INTEGER PRIMARY KEY,
  service_id  INTEGER NOT NULL,
  task_id     INTEGER,  -- the task for check/uncheck; null for service-wide reset/undo_reset
  action      TEXT NOT NULL CHECK (action IN ('check', 'uncheck', 'reset', 'undo_reset')),
  -- applied: state changed. no_change: nothing to change (already checked, nothing to reset/undo).
  -- not_found: task not live in the service's list. service_changed: not the current service.
  outcome     TEXT NOT NULL CHECK (outcome IN ('applied', 'no_change', 'not_found', 'service_changed')),
  affected    INTEGER,  -- check-offs archived (reset) or restored (undo_reset)
  user_pco_id TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  session_id  TEXT,  -- random ID fixed at sign-in, kept when the session cookie renews
  tab_id      TEXT,  -- random ID per page load, sent by the browser (X-Tab-Id header)
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((action IN ('check', 'uncheck')) = (task_id IS NOT NULL))
);

CREATE INDEX checkoff_events_service ON checkoff_events (service_id, id);

CREATE TRIGGER checkoff_events_no_update BEFORE UPDATE ON checkoff_events
BEGIN
  SELECT RAISE(ABORT, 'checkoff_events is append-only');
END;

CREATE TRIGGER checkoff_events_no_delete BEFORE DELETE ON checkoff_events
BEGIN
  SELECT RAISE(ABORT, 'checkoff_events is append-only');
END;
