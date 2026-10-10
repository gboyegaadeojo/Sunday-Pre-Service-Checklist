-- Schema for the media team checklist. See docs/build-plan.md section 3.
-- Timestamps are ISO 8601 UTC. service_date is YYYY-MM-DD in the church's time zone (a setting).
-- People are app users with an internal ID (US-03a); sign-in accounts are linked to them, and everything
-- else refers to users.id. IDs from outside sources (e.g. Planning Center) are stored as a source name
-- plus that source's ID, in provider-neutral columns (requirements C22).
-- Checklist definition rows are never deleted: deleted_at hides them (US-12, US-12a, US-13).

-- Users and settings ---------------------------------------------------------

-- AUTOINCREMENT: a user ID is never reused, so records can never point at the wrong person.
CREATE TABLE users (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name     TEXT NOT NULL,
  avatar_url       TEXT,
  is_admin         INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  is_director      INTEGER NOT NULL DEFAULT 0 CHECK (is_director IN (0, 1)),
  team_verified_at TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at     TEXT
);

-- Sign-in accounts linked to a user (US-03a): provider 'planning_center', 'dev' (local test users), later
-- possibly 'google'. subject is the provider's ID for the person. Each account links to exactly one user.
CREATE TABLE user_identities (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users (id),
  provider     TEXT NOT NULL,
  subject      TEXT NOT NULL,
  email        TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at TEXT
);
CREATE UNIQUE INDEX user_identities_account ON user_identities (provider, subject);
CREATE INDEX user_identities_user ON user_identities (user_id);

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

-- One service per service day (Q4). Created lazily when first opened (US-07).
-- AUTOINCREMENT: a service ID is never reused, so the activity log (keyed by service_id, no FK)
-- can never point at the wrong service.
CREATE TABLE services (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  service_date     TEXT NOT NULL UNIQUE,
  plan_source      TEXT,  -- schedule source of the plan for this service (e.g. 'planning_center'); null = none published
  plan_external_id TEXT,
  list_id          INTEGER NOT NULL REFERENCES task_lists (id),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((plan_source IS NULL) = (plan_external_id IS NULL))
);

-- Only the latest reset with undone_at IS NULL can be undone (US-07).
CREATE TABLE resets (
  id               INTEGER PRIMARY KEY,
  service_id       INTEGER NOT NULL REFERENCES services (id),
  reset_by_user_id  INTEGER NOT NULL REFERENCES users (id),
  reset_by_name     TEXT NOT NULL,
  reset_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_count   INTEGER NOT NULL DEFAULT 0,  -- check-offs this reset archived
  undone_by_user_id INTEGER REFERENCES users (id),
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
  checked_by_user_id     INTEGER NOT NULL REFERENCES users (id),
  checked_by_name        TEXT NOT NULL,
  checked_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unchecked_by_user_id   INTEGER REFERENCES users (id),
  unchecked_by_name      TEXT,
  unchecked_at           TEXT,
  reset_id               INTEGER REFERENCES resets (id)
);
CREATE INDEX checkoffs_service ON checkoffs (service_id);

-- At most one active check-off per task per service.
CREATE UNIQUE INDEX checkoffs_one_active ON checkoffs (service_id, task_id)
  WHERE unchecked_at IS NULL AND reset_id IS NULL;

-- Schedule source (Planning Center today) -------------------------------------

-- Links from a schedule source's team or position to a department (US-15). source names where the
-- external IDs come from. A null position_external_id is a team-level link; a position link overrides
-- its team link. Names are the last known ones, for display and for flagging links gone missing.
CREATE TABLE team_links (
  id                   INTEGER PRIMARY KEY,
  source               TEXT NOT NULL,
  team_external_id     TEXT NOT NULL,
  position_external_id TEXT,
  category_id          INTEGER NOT NULL REFERENCES categories (id),
  team_name            TEXT NOT NULL,
  position_name        TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Each team or position links to exactly one category (D2).
CREATE UNIQUE INDEX team_links_target ON team_links (source, team_external_id, IFNULL(position_external_id, ''));
CREATE INDEX team_links_category ON team_links (category_id);

-- Short-lived schedule-source responses (Architecture Note).
CREATE TABLE source_cache (
  key        TEXT PRIMARY KEY,
  json       TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
