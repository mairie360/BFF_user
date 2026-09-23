-- Minimal seed for the isolated test stacks (performance / security) of BFF User.
-- The test JWTs reference two users:
--   * sub = "1": Admin role. docker-compose-security.yml injects a static token for it
--     through the ZAP replacer, so every operation (including /bff/admin/*) is scanned
--     authenticated;
--   * sub = "2": User role only. load-test.js signs a token for it on the fly.
-- The other rows are scan fixtures: ZAP fills a path parameter with its contract example, or
-- with 10 when there is none, so the admin routes reach Core API business logic instead of a 404:
--   * user 10, role 10, group 10 (with user 10 as member) are read and updated;
--   * user 11, role 11, group 11 are the examples of the DELETE routes;
--   * user 42 is the example of /user/{userId}/about and of a new group member;
--   * two sessions hold the example refresh tokens of /bff/admin/sessions/refresh (user 2) and
--     /bff/admin/sessions/revoke (user 1: Core API only revokes the caller's own sessions).
--     Core API stores the refresh token itself in token_hash.

INSERT INTO users (id, first_name, last_name, email, password, status)
VALUES
    (1, 'Security', 'Admin', 'security-admin@mairie360.fr', 'dummy', 'active'),
    (2, 'Perf', 'Tester', 'perf-tester@mairie360.fr', 'dummy', 'active'),
    (10, 'Scan', 'Target', 'scan-target@mairie360.fr', 'dummy', 'active'),
    (11, 'Scan', 'Deleted', 'scan-deleted@mairie360.fr', 'dummy', 'active'),
    (42, 'Scan', 'Member', 'scan-member@mairie360.fr', 'dummy', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO roles (id, name, description, can_be_deleted)
VALUES
    (10, 'Scan role', 'Role edited by the ZAP scan', TRUE),
    (11, 'Scan deleted role', 'Role deleted by the ZAP scan', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO groups (id, owner_id, name, description)
VALUES
    (10, 1, 'Scan group', 'Group edited by the ZAP scan'),
    (11, 1, 'Scan deleted group', 'Group deleted by the ZAP scan')
ON CONFLICT (id) DO NOTHING;

INSERT INTO group_members (group_id, user_id)
VALUES (10, 10)
ON CONFLICT DO NOTHING;

-- Core API >= 1.1.1 requires at least one role on the user for GET /user/me and
-- GET /user/{id} (otherwise Core panics with "index out of bounds" -> 502 on the BFF).
-- Core returns a single role: user 1 must only hold Admin for requireAdmin to pass.
DELETE FROM user_roles
WHERE user_id = 1 AND role_id <> (SELECT id FROM roles WHERE lower(name) = 'admin');

INSERT INTO user_roles (user_id, role_id)
SELECT 1, r.id FROM roles r WHERE lower(r.name) = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM roles r CROSS JOIN (VALUES (2), (10), (11), (42)) AS u(id) WHERE lower(r.name) = 'user'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
VALUES (10, 10)
ON CONFLICT DO NOTHING;

INSERT INTO sessions (user_id, token_hash, device_info, ip_address)
VALUES
    (2, 'opaque-refresh-token', 'ZAP scan', '127.0.0.1'),
    (1, 'opaque-revoked-token', 'ZAP scan', '127.0.0.1')
ON CONFLICT (token_hash) DO NOTHING;

-- Explicit ids do not advance the sequences: move them past the seeded rows so that the
-- rows created during the scan (users, roles, groups) do not collide.
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT max(id) FROM users));
SELECT setval(pg_get_serial_sequence('roles', 'id'), (SELECT max(id) FROM roles));
SELECT setval(pg_get_serial_sequence('groups', 'id'), (SELECT max(id) FROM groups));
