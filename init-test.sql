-- Seed minimal pour les tests isolés (performance / sécurité) du BFF User.
-- L'utilisateur 2 est celui référencé par les JWT de test (claim sub = "2") :
--   * load-test.js le signe dynamiquement,
--   * docker-compose-security.yml injecte un token statique via le replacer ZAP.
-- Un utilisateur sans rôle ni groupe suffit : les routes /bff/admin/* sont alors
-- refusées en 403 (comportement attendu, pas une faille), les lectures /me,
-- /session/me et /user/2/about répondent en 200.

INSERT INTO users (id, first_name, last_name, email, password, status)
VALUES (2, 'Perf', 'Tester', 'perf-tester@mairie360.fr', 'dummy', 'active')
ON CONFLICT (id) DO NOTHING;
