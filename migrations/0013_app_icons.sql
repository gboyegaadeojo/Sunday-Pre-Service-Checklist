-- Installable app (Stage 13, requirements C42): the app icons made from the logo mark. An Admin's browser draws them
-- (the short name in white on the purple) when the short name is saved in Church settings, or on request, and uploads
-- them here; the Worker serves them for the manifest and iPhone's home screen. Until then, a neutral icon is served.
-- The "Home screen name" is an ordinary setting (key home_screen_name), so it needs no table.
CREATE TABLE app_icons (
  name       TEXT PRIMARY KEY CHECK (name IN ('icon-192', 'icon-512', 'maskable-512', 'apple-touch-icon')),
  png        BLOB NOT NULL,
  short_name TEXT NOT NULL,  -- the short name drawn on it
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
