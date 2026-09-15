import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { JsonSchema, OpenApiContract } from './support/openapi-contract';
import { loadOrvalContract, resolveOrvalPackage } from './support/orval-contract';
import { CORE_CONTRACT_GAPS, group, meResponse, role, session, userResponse } from './support/core-fixtures';

// Le contrat Core API est reconstruit depuis le paquet @mairie360/core-api-openapi installé :
// monter la version dans package.json suffit à tester le BFF contre le nouveau contrat.

const PACKAGE = '@mairie360/core-api-openapi';

// Opérations Core API réellement appelées par les routes du BFF (src/clients/coreClient.ts, src/routes/check_apis.ts).
const CONSUMED = [
  { operationId: 'login', method: 'post', template: '/api/v1/auth/login' },
  { operationId: 'register', method: 'post', template: '/api/v1/auth/register' },
  { operationId: 'forceChangePassword', method: 'post', template: '/api/v1/auth/force_change_password/' },
  { operationId: 'adminPostUser', method: 'post', template: '/api/v1/admin/users/' },
  { operationId: 'adminPatchUser', method: 'patch', template: '/api/v1/admin/users/{userId}/' },
  { operationId: 'adminAddRoleToUser', method: 'post', template: '/api/v1/admin/users/{userId}/roles/' },
  { operationId: 'adminDeleteUserRole', method: 'delete', template: '/api/v1/admin/users/{userId}/roles/{roleId}' },
  { operationId: 'adminGetRole', method: 'get', template: '/api/v1/admin/roles/' },
  { operationId: 'adminPostRole', method: 'post', template: '/api/v1/admin/roles/' },
  { operationId: 'adminPutRole', method: 'put', template: '/api/v1/admin/roles/{id}' },
  { operationId: 'adminPatchRole', method: 'patch', template: '/api/v1/admin/roles/{id}' },
  { operationId: 'adminDeleteRole', method: 'delete', template: '/api/v1/admin/roles/{id}' },
  { operationId: 'getMe', method: 'get', template: '/api/v1/user/me/' },
  { operationId: 'getUser', method: 'get', template: '/api/v1/user/{id}/' },
  { operationId: 'getGroups', method: 'get', template: '/api/v1/groups/' },
  { operationId: 'postGroup', method: 'post', template: '/api/v1/groups/' },
  { operationId: 'getGroup', method: 'get', template: '/api/v1/groups/{groupId}/' },
  { operationId: 'deleteGroup', method: 'delete', template: '/api/v1/groups/{groupId}/' },
  { operationId: 'getActiveSessions', method: 'get', template: '/api/v1/sessions/' },
  { operationId: 'history', method: 'get', template: '/api/v1/sessions/history' },
  { operationId: 'refresh', method: 'post', template: '/api/v1/sessions/refresh' },
  { operationId: 'revoke', method: 'post', template: '/api/v1/sessions/revoke' },
  { operationId: 'health', method: 'get', template: '/health' },
] as const;

const coreApi = loadOrvalContract(PACKAGE);

function responseSchema(contract: OpenApiContract, method: string, pathname: string, status: number): JsonSchema {
  const match = contract.match(method, pathname);
  if (!match) throw new Error(`${method} ${pathname} absent de ${contract.title}`);
  const { schema } = contract.responseSchema(match, status);
  if (!schema) throw new Error(`Pas de schéma JSON pour ${status} ${method} ${pathname}`);
  return schema;
}

describe('Core API contract from the installed @mairie360/core-api-openapi package', () => {
  test('is the version pinned in package.json', () => {
    const { dependencies } = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(coreApi.title).toBe('core_api');
    expect(resolveOrvalPackage(PACKAGE).version).toBe(dependencies[PACKAGE]);
  });

  test.each(CONSUMED)('declares $operationId as $method $template', ({ operationId, method, template }) => {
    const operation = coreApi.document.paths[template]?.[method] as { operationId?: string } | undefined;
    expect(operation?.operationId).toBe(operationId);
  });

  test('keeps request parameters, bodies and response models of the consumed operations', () => {
    const patch = coreApi.match('PATCH', '/api/v1/admin/users/7/')!;
    expect(patch.operation.parameters).toEqual([{ name: 'userId', in: 'path', required: true, schema: { type: 'number' } }]);
    expect(coreApi.requestBodySchema(patch)).toEqual({ required: true, schema: { $ref: '#/components/schemas/PatchUserView' } });
    expect(coreApi.schema('LoginView')).toMatchObject({ required: ['device_info', 'email', 'password'] });
    expect(coreApi.schema('AddRoleToUserView')).toMatchObject({ properties: { role_id: { type: 'number', minimum: 0 } } });
    expect(coreApi.responseSchema(coreApi.match('GET', '/health')!, 200)).toEqual({ documented: true, schema: undefined });
    // Les erreurs ne sont pas typées par orval : aucun statut hors 2XX n'est documenté.
    expect(coreApi.responseSchema(coreApi.match('POST', '/api/v1/auth/login')!, 401).documented).toBe(false);
  });
});

describe('known gaps between the published Core API contract and Core API v1.1.1', () => {
  // Quand un de ces tests échoue, le paquet publié a été corrigé : retirer l'écart de CORE_CONTRACT_GAPS
  // (tests/support/core-fixtures.ts) ou l'allowDeviation correspondant de user.upstream-mocks.test.ts.

  test.each(CORE_CONTRACT_GAPS)('$reason', ({ method, template }) => {
    expect(coreApi.document.paths[template]?.[method]).toBeUndefined();
  });

  test('GET /api/v1/sessions/ is typed with the roles GetResponseView instead of { sessions }', () => {
    // Deux structs Rust GetResponseView (rôles et sessions) : orval n'en garde qu'une.
    const schema = responseSchema(coreApi, 'get', '/api/v1/sessions/', 200);
    expect(schema).toEqual({ $ref: '#/components/schemas/GetResponseView' });
    expect(coreApi.validate(schema, { sessions: [session('s-1')] })).toEqual(['$.roles: propriété requise manquante']);
  });
});

describe('Core API fixtures conform to the Core API contract', () => {
  test.each([
    ['POST /api/v1/auth/login 200', 'post', '/api/v1/auth/login', { refresh_token: 'opaque-refresh-token' }],
    ['GET /api/v1/user/me/ 200', 'get', '/api/v1/user/me/', meResponse({ phone: null })],
    ['GET /api/v1/user/{id}/ 200', 'get', '/api/v1/user/7/', userResponse()],
    ['GET /api/v1/groups/ 200', 'get', '/api/v1/groups/', { groups: [group(1), group(2, { description: null })] }],
    ['GET /api/v1/groups/{groupId}/ 200', 'get', '/api/v1/groups/5/', { group: group(5) }],
    ['GET /api/v1/admin/roles/ 200', 'get', '/api/v1/admin/roles/', { roles: [role(1), role(2)] }],
    ['GET /api/v1/sessions/history 200', 'get', '/api/v1/sessions/history', { sessions: [session('s-1'), session('s-2', { revoked_at: '2026-09-16T08:00:00Z' })] }],
  ] as const)('%s', (_name, method, pathname, body) => {
    expect(coreApi.validate(responseSchema(coreApi, method, pathname, 200), body)).toEqual([]);
  });
});

describe('contract validator', () => {
  test('reports missing required properties, wrong types and minimum', () => {
    const invalid = { roles: [{ ...role(1), id: -1 }, { name: 'Sans id', description: 3 }] };
    expect(coreApi.validate(responseSchema(coreApi, 'get', '/api/v1/admin/roles/', 200), invalid)).toEqual(expect.arrayContaining([
      expect.stringContaining('$.roles[0].id: -1 < minimum 0'),
      expect.stringContaining('$.roles[1].id: propriété requise manquante'),
      expect.stringContaining('$.roles[1].description: type string attendu'),
    ]));
  });

  test('matches literal paths before templated ones and validates path parameters and bodies', () => {
    expect(coreApi.match('GET', '/api/v1/user/me/')?.template).toBe('/api/v1/user/me/');
    expect(coreApi.match('DELETE', '/api/v1/admin/users/7/roles/3')).toMatchObject({
      template: '/api/v1/admin/users/{userId}/roles/{roleId}', pathParams: { userId: '7', roleId: '3' },
    });
    expect(coreApi.validateRequest('GET', new URL('http://core/api/v1/groups/abc/')).errors)
      .toEqual([expect.stringContaining('path.groupId: type number attendu')]);
    const login = coreApi.match('POST', '/api/v1/auth/login')!;
    expect(coreApi.validate(coreApi.requestBodySchema(login).schema!, { email: 'alice@mairie.test' }))
      .toEqual(expect.arrayContaining([expect.stringContaining('$.password: propriété requise manquante')]));
  });
});
