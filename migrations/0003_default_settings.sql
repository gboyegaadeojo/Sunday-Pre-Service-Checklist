-- Starting values for church-specific settings ("Everything is editable", CLAUDE.md).
-- These are data, not code: admins edit them in the app (build plan Stage 5).

INSERT INTO settings (key, value) VALUES
  -- Branding shown in the header, on the sign-in screen and in the browser tab.
  ('church_short_name', 'IFC'),                  -- logo mark
  ('team_name', 'IFC Production'),
  ('app_name', 'Pre-Service Checklist'),
  -- Service calendar (US-07). IANA time zone; weekday 0 = Sunday … 6 = Saturday.
  ('time_zone', 'America/Winnipeg'),
  ('service_weekday', '0');
