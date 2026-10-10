-- There must always be at least one Admin (US-03, requirements v1.17). The app refuses to remove the last Admin
-- (db/roles.ts); this trigger makes it impossible however the change is attempted. D1 runs writes one at a time,
-- so two Admins removing each other at the same moment can't both succeed: whichever runs second finds no other
-- Admin left and is aborted, with everything else in its transaction (its log entry included).

CREATE TRIGGER users_keep_an_admin BEFORE UPDATE OF is_admin ON users
WHEN OLD.is_admin = 1 AND NEW.is_admin = 0
 AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin = 1 AND id <> OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'users: there must always be at least one Admin');
END;
