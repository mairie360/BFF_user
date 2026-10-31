-- Volume seed of the performance stack (MAIR-474), run by the `seeder` service after
-- init-test.sql. Without it the admin listings read a handful of rows and `/me` a user with one
-- group, so the cost of the reads the BFF relays from Core API is never measured.
--
-- - 10 000 agents (`User`, ids 500001..510000) with 5 sessions each (4 revoked);
-- - 2 000 groups (ids 50000..51999) of 20 agents each: agent 500001 + r is in groups
--   50000 + (r % 2000) and the next ones; the Admin (user 1) is a member of the first 300;
-- - 1 000 revoked sessions of the Admin, for the session history.
-- load-test.js derives the same ids to read as an agent (tokens signed with the run's secret).
--
-- Fixed ids, ON CONFLICT DO NOTHING: the file is idempotent, like init-test.sql. The password is
-- the public argon2id hash of init-test.sql.

INSERT INTO users (id, first_name, last_name, email, password, status)
SELECT n,
       (ARRAY['Jean', 'Marie', 'Louis', 'Camille', 'Hugo', 'Léa', 'Paul', 'Chloé'])[1 + n % 8],
       (ARRAY['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand'])[1 + (n / 8) % 8] || ' ' || n,
       'perf.agent.' || n || '@mairie360.fr',
       '$argon2id$v=19$m=19456,t=2,p=1$/iKF9PbiDRDs4EKPjlIIhg$UKx9vfwwps250mEP/bYp63CXbEnQGULeUAhDq+az9Aw',
       'active'
FROM generate_series(500001, 510000) AS n
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT n, r.id FROM generate_series(500001, 510000) AS n CROSS JOIN roles r WHERE lower(r.name) = 'user'
ON CONFLICT DO NOTHING;

INSERT INTO groups (id, owner_id, name, description)
SELECT 50000 + g, 500001 + g, 'Perf service ' || g, 'Performance seed'
FROM generate_series(0, 1999) AS g
ON CONFLICT (id) DO NOTHING;

INSERT INTO group_members (group_id, user_id)
SELECT 50000 + g, 500001 + (g + 500 * k) % 10000
FROM generate_series(0, 1999) AS g CROSS JOIN generate_series(0, 19) AS k
ON CONFLICT DO NOTHING;

INSERT INTO group_members (group_id, user_id)
SELECT 50000 + g, 1 FROM generate_series(0, 299) AS g
ON CONFLICT DO NOTHING;

INSERT INTO sessions (user_id, token_hash, device_info, ip_address, created_at, revoked_at)
SELECT n, encode(sha256(convert_to(format('perf-session-%s-%s', n, s), 'UTF8')), 'hex'),
       'Firefox 141 on Windows 11', '10.20.0.1'::inet,
       now() - make_interval(hours => 5 - s),
       CASE WHEN s < 5 THEN now() - make_interval(hours => 5 - s) + interval '30 minutes' END
FROM generate_series(500001, 510000) AS n CROSS JOIN generate_series(1, 5) AS s
WHERE NOT EXISTS (SELECT 1 FROM sessions WHERE user_id = 500001);

INSERT INTO sessions (user_id, token_hash, device_info, ip_address, created_at, revoked_at)
SELECT 1, encode(sha256(convert_to(format('perf-admin-session-%s', s), 'UTF8')), 'hex'),
       'Chrome 140 on macOS', '10.20.0.2'::inet,
       now() - make_interval(hours => s), now() - make_interval(hours => s) + interval '30 minutes'
FROM generate_series(1, 1000) AS s
WHERE NOT EXISTS (SELECT 1 FROM sessions WHERE device_info = 'Chrome 140 on macOS' AND user_id = 1);

SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('groups', 'id'), GREATEST((SELECT MAX(id) FROM groups), 1));

ANALYZE users;
ANALYZE user_roles;
ANALYZE groups;
ANALYZE group_members;
ANALYZE sessions;
