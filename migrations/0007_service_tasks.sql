-- The record of each service's checklist (US-07b, requirements v1.16): every task that was on it while the
-- service was current, where it was at the end (or when it was removed), so service history can show
-- "X of Y done" and the tasks that weren't checked.
--
-- Kept up to date while the service is current: seeded when the service first loads (db/services.ts), then
-- reconciled with the live list in the same transaction as every checklist edit (db/service-record.ts). Once
-- the service ends (midnight after its date, church time zone) it is no longer current and nothing writes to
-- its rows again. Services from before this migration have no record (tasks_recorded_from IS NULL).

ALTER TABLE services ADD COLUMN tasks_recorded_from TEXT;  -- when recording started; NULL = no record

CREATE TABLE service_tasks (
  service_id     INTEGER NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  task_id        INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  text           TEXT NOT NULL,
  category_id    INTEGER NOT NULL,
  category_name  TEXT NOT NULL,
  category_order INTEGER NOT NULL,  -- sort_order values at the time, for display order
  section_id     INTEGER NOT NULL,
  section_name   TEXT NOT NULL,
  section_order  INTEGER NOT NULL,
  task_order     INTEGER NOT NULL,
  added_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  removed_at     TEXT,  -- hidden (or its section/department hidden) during the service; NULL = on the checklist
  PRIMARY KEY (service_id, task_id)
);

-- A safety net behind the app's own rule (it only writes the current service's record): refuse writes to the
-- record of a service that has clearly ended. SQL can't know the church's time zone, so this allows a day's
-- margin in UTC, which never blocks a service that is still current in any time zone.
CREATE TRIGGER service_tasks_frozen_insert BEFORE INSERT ON service_tasks
WHEN (SELECT service_date FROM services WHERE id = NEW.service_id) < date('now', '-1 day')
BEGIN
  SELECT RAISE(ABORT, 'service_tasks: that service has ended');
END;

CREATE TRIGGER service_tasks_frozen_update BEFORE UPDATE ON service_tasks
WHEN (SELECT service_date FROM services WHERE id = OLD.service_id) < date('now', '-1 day')
BEGIN
  SELECT RAISE(ABORT, 'service_tasks: that service has ended');
END;
