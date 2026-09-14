-- Seed minimal pour les tests isolés (performance / sécurité) du BFF User.
-- L'utilisateur 2 est celui référencé par les JWT de test (claim sub = "2") :
--   * load-test.js le signe dynamiquement,
--   * docker-compose-security.yml injecte un token statique via le replacer ZAP.
-- Un utilisateur avec le seul rôle "User" et sans groupe suffit : les routes
-- /bff/admin/* sont alors refusées en 403 (comportement attendu, pas une faille),
-- les lectures /me, /session/me et /user/2/about répondent en 200.

INSERT INTO users (id, first_name, last_name, email, password, status)
VALUES (2, 'Perf', 'Tester', 'perf-tester@mairie360.fr', 'dummy', 'active')
ON CONFLICT (id) DO NOTHING;

-- Core API >= 1.1.1 exige au moins un rôle sur l'utilisateur pour GET /user/me
-- et GET /user/{id} (sinon panic "index out of bounds" côté Core -> 502 côté BFF).
-- Le rôle "User" (id 4, seedé par les migrations) ne donne pas l'accès admin :
-- les routes /bff/admin/* restent refusées en 403.
INSERT INTO user_roles (user_id, role_id)
SELECT 2, r.id FROM roles r WHERE lower(r.name) = 'user'
ON CONFLICT DO NOTHING;
