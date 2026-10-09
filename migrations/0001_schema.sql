-- Schema for the media team checklist. See docs/build-plan.md section 3.
-- Timestamps are ISO 8601 UTC. service_date is YYYY-MM-DD in America/Winnipeg.
-- Checklist definition rows are never deleted: deleted_at hides them (US-12, US-12a, US-13).

-- Users and settings ---------------------------------------------------------

CREATE TABLE users (
  pco_person_id    TEXT PRIMARY KEY,
  display_name     TEXT NOT NULL,
  avatar_url       TEXT,
  is_admin         INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  is_director      INTEGER NOT NULL DEFAULT 0 CHECK (is_director IN (0, 1)),
  team_verified_at TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at     TEXT
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Checklist definition -------------------------------------------------------

CREATE TABLE task_lists (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  is_default  INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  deleted_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- At most one live default list.
CREATE UNIQUE INDEX task_lists_one_default ON task_lists (is_default)
  WHERE is_default = 1 AND deleted_at IS NULL;

CREATE TABLE categories (
  id         INTEGER PRIMARY KEY,
  list_id    INTEGER NOT NULL REFERENCES task_lists (id),
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  deleted_at TEXT
);
CREATE INDEX categories_list ON categories (list_id);

CREATE TABLE sections (
  id          INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories (id),
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX sections_category ON sections (category_id);

CREATE TABLE tasks (
  id         INTEGER PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES sections (id),
  text       TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  deleted_at TEXT
);
CREATE INDEX tasks_section ON tasks (section_id);

-- Services and check-offs ----------------------------------------------------

-- One service per Sunday (Q4). Created lazily when first opened (US-07).
CREATE TABLE services (
  id           INTEGER PRIMARY KEY,
  service_date TEXT NOT NULL UNIQUE,
  pco_plan_id  TEXT,
  list_id      INTEGER NOT NULL REFERENCES task_lists (id),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Only the latest reset with undone_at IS NULL can be undone (US-07).
CREATE TABLE resets (
  id               INTEGER PRIMARY KEY,
  service_id       INTEGER NOT NULL REFERENCES services (id),
  reset_by_pco_id  TEXT NOT NULL,
  reset_by_name    TEXT NOT NULL,
  reset_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  undone_by_pco_id TEXT,
  undone_by_name   TEXT,
  undone_at        TEXT
);
CREATE INDEX resets_service ON resets (service_id);

-- One row per check. Unchecking fills unchecked_*; a reset fills reset_id.
-- The *_snapshot columns record the task's text, department and section at check-off time, so
-- past services show tasks where they were even after admins move or rename them (US-06, US-13).
-- The current service places check-offs by the task's current location (via task_id) instead.
CREATE TABLE checkoffs (
  id                     INTEGER PRIMARY KEY,
  service_id             INTEGER NOT NULL REFERENCES services (id),
  task_id                INTEGER NOT NULL REFERENCES tasks (id),
  task_text_snapshot     TEXT NOT NULL,
  category_id_snapshot   INTEGER NOT NULL REFERENCES categories (id),
  category_name_snapshot TEXT NOT NULL,
  section_id_snapshot    INTEGER NOT NULL REFERENCES sections (id),
  section_name_snapshot  TEXT NOT NULL,
  checked_by_pco_id      TEXT NOT NULL,
  checked_by_name        TEXT NOT NULL,
  checked_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unchecked_by_pco_id    TEXT,
  unchecked_by_name      TEXT,
  unchecked_at           TEXT,
  reset_id               INTEGER REFERENCES resets (id)
);
CREATE INDEX checkoffs_service ON checkoffs (service_id);

-- At most one active check-off per task per service.
CREATE UNIQUE INDEX checkoffs_one_active ON checkoffs (service_id, task_id)
  WHERE unchecked_at IS NULL AND reset_id IS NULL;

-- Planning Center ------------------------------------------------------------

-- A null pco_position_id is a team-level link. A position link overrides its team link (US-15).
CREATE TABLE team_links (
  id                INTEGER PRIMARY KEY,
  pco_team_id       TEXT NOT NULL,
  pco_position_id   TEXT,
  category_id       INTEGER NOT NULL REFERENCES categories (id),
  pco_team_name     TEXT NOT NULL,
  pco_position_name TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Each team or position links to exactly one category (D2).
CREATE UNIQUE INDEX team_links_target ON team_links (pco_team_id, IFNULL(pco_position_id, ''));
CREATE INDEX team_links_category ON team_links (category_id);

CREATE TABLE pco_cache (
  key        TEXT PRIMARY KEY,
  json       TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
