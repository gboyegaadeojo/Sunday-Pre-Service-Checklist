-- Append-only log of checklist edits (US-13b): every add, rename, edit, hide, restore, move and reorder of
-- a department (category), section or task, with who, when and the before/after values. Only applied
-- changes are logged, in the same transaction as the change. Rows are never edited or deleted: the
-- triggers below abort any UPDATE or DELETE. No foreign keys, so the log outlives anything it refers to.

CREATE TABLE checklist_events (
  id          INTEGER PRIMARY KEY,
  list_id     INTEGER NOT NULL,
  entity      TEXT NOT NULL CHECK (entity IN ('category', 'section', 'task')),
  entity_id   INTEGER NOT NULL,
  entity_name TEXT NOT NULL,  -- its name/text after the change, so the entry reads right after later renames
  action      TEXT NOT NULL CHECK (action IN ('add', 'rename', 'edit', 'hide', 'restore', 'move', 'reorder')),
  before_json TEXT CHECK (before_json IS NULL OR json_valid(before_json)),  -- only what changed, e.g. {"name": …}
  after_json  TEXT CHECK (after_json IS NULL OR json_valid(after_json)),
  user_pco_id TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  session_id  TEXT,  -- random ID fixed at sign-in, kept when the session cookie renews
  tab_id      TEXT,  -- random ID per page load, sent by the browser (X-Tab-Id header)
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX checklist_events_list ON checklist_events (list_id, id);

CREATE TRIGGER checklist_events_no_update BEFORE UPDATE ON checklist_events
BEGIN
  SELECT RAISE(ABORT, 'checklist_events is append-only');
END;

CREATE TRIGGER checklist_events_no_delete BEFORE DELETE ON checklist_events
BEGIN
  SELECT RAISE(ABORT, 'checklist_events is append-only');
END;
