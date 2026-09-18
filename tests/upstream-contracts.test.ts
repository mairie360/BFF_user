import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { JsonSchema, OpenApiContract } from './support/openapi-contract';
import { loadOrvalContract, resolveOrvalPackage } from './support/orval-contract';
import {
  adminUserRow, adminUsersPage, coreApiUrls, group, groupResult, groupsResult, historyResult, loginResponse, meResponse, role, rolesResult,
  session, sessionsResult, userResponse,
} from './support/core-fixtures';

// Le contrat Core API est reconstruit depuis le paquet @mairie360/core-api-openapi installé :
// monter la version dans package.json suffit à tester le BFF contre le nouveau contrat.

const PACKAGE = '@mairie360/core-api-openapi';

const coreApi = loadOrvalContract(PACKAGE);

/** Chemin d'une opération tel que le client généré le construit (helper `get*Url`), sans sa query string. */
const pathname = (url: string) => new URL(url, 'http://upstream').pathname;

// Opérations Core API réellement appelées par les routes du BFF (src/clients/coreClient.ts, src/routes/check_apis.ts),
// adressées par les helpers d'URL du client généré.
const CONSUMED = [
  { operationId: 'login', method: 'post', url: coreApiUrls.getLoginUrl() },
  { operationId: 'register', method: 'post', url: coreApiUrls.getRegisterUrl() },
  { operationId: 'forceChangePassword', method: 'post', url: coreApiUrls.getForceChangePasswordUrl() },
  { operationId: 'adminListUsers', method: 'get', url: coreApiUrls.getAdminListUsersUrl({ page: 2, page_size: 5 }) },
  { operationId: 'adminPostUser', method: 'post', url: coreApiUrls.getAdminPostUserUrl() },
  { operationId: 'adminDeleteUser', method: 'delete', url: coreApiUrls.getAdminDeleteUserUrl(7) },
  { operationId: 'adminResetUserPassword', method: 'patch', url: coreApiUrls.getAdminResetUserPasswordUrl(7) },
  { operationId: 'adminPatchUser', method: 'patch', url: coreApiUrls.getAdminPatchUserUrl(7) },
  { operationId: 'adminAddRoleToUser', method: 'post', url: coreApiUrls.getAdminAddRoleToUserUrl(7) },
  { operationId: 'adminDeleteUserRole', method: 'delete', url: coreApiUrls.getAdminDeleteUserRoleUrl(7, 3) },
  { operationId: 'adminGetRole', method: 'get', url: coreApiUrls.getAdminGetRoleUrl() },
  { operationId: 'adminPostRole', method: 'post', url: coreApiUrls.getAdminPostRoleUrl() },
  { operationId: 'adminPutRole', method: 'put', url: coreApiUrls.getAdminPutRoleUrl(3) },
  { operationId: 'adminPatchRole', method: 'patch', url: coreApiUrls.getAdminPatchRoleUrl(3) },
  { operationId: 'adminDeleteRole', method: 'delete', url: coreApiUrls.getAdminDeleteRoleUrl(3) },
  { operationId: 'getMe', method: 'get', url: coreApiUrls.getGetMeUrl() },
  { operationId: 'getUser', method: 'get', url: coreApiUrls.getGetUserUrl(7) },
  { operationId: 'getGroups', method: 'get', url: coreApiUrls.getGetGroupsUrl() },
  { operationId: 'postGroup', method: 'post', url: coreApiUrls.getPostGroupUrl() },
  { operationId: 'getGroup', method: 'get', url: coreApiUrls.getGetGroupUrl(5) },
  { operationId: 'patchGroup', method: 'patch', url: coreApiUrls.getPatchGroupUrl(5) },
  { operationId: 'deleteGroup', method: 'delete', url: coreApiUrls.getDeleteGroupUrl(5) },
  { operationId: 'getGroupMembers', method: 'get', url: coreApiUrls.getGetGroupMembersUrl(5) },
  { operationId: 'addUserToGroup', method: 'post', url: coreApiUrls.getAddUserToGroupUrl(5) },
  { operationId: 'removeUserFromGroup', method: 'delete', url: coreApiUrls.getRemoveUserFromGroupUrl(5, 7) },
  { operationId: 'getActiveSessions', method: 'get', url: coreApiUrls.getGetActiveSessionsUrl() },
  { operationId: 'history', method: 'get', url: coreApiUrls.getHistoryUrl() },
  { operationId: 'refresh', method: 'post', url: coreApiUrls.getRefreshUrl() },
  { operationId: 'revoke', method: 'post', url: coreApiUrls.getRevokeUrl() },
  { operationId: 'health', method: 'get', url: coreApiUrls.getHealthUrl() },
] as const;

function responseSchema(contract: OpenApiContract, method: string, url: string, status: number): JsonSchema {
  const match = contract.match(method, pathname(url));
  if (!match) throw new Error(`${method} ${url} absent de ${contract.title}`);
  const { schema } = contract.responseSchema(match, status);
  if (!schema) throw new Error(`Pas de schéma JSON pour ${status} ${method} ${url}`);
  return schema;
}

describe('Core API contract from the installed @mairie360/core-api-openapi package', () => {
  test('is the version pinned in package.json', () => {
    const { dependencies } = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(coreApi.title).toMatch(/^Core API/);
    expect(resolveOrvalPackage(PACKAGE).version).toBe(dependencies[PACKAGE]);
  });

  test.each(CONSUMED)('routes $method $url to $operationId', ({ operationId, method, url }) => {
    const { match, errors } = coreApi.validateRequest(method, new URL(url, 'http://upstream'));
    expect(errors).toEqual([]);
    expect((match?.operation as { operationId?: string } | undefined)?.operationId).toBe(operationId);
  });

  test('keeps request parameters, bodies and response models of the consumed operations', () => {
    const patch = coreApi.match('PATCH', coreApiUrls.getAdminPatchUserUrl(7))!;
    expect(patch.operation.parameters).toEqual([{ name: 'userId', in: 'path', required: true, schema: { type: 'number' } }]);
    expect(coreApi.requestBodySchema(patch)).toEqual({ required: true, schema: { $ref: '#/components/schemas/PatchUserView' } });
    expect(coreApi.schema('LoginView')).toMatchObject({ required: ['device_info', 'email', 'password'] });
    expect(coreApi.schema('AddRoleToUserView')).toMatchObject({ properties: { role_id: { type: 'number', minimum: 0 } } });
    expect(coreApi.responseSchema(coreApi.match('GET', coreApiUrls.getHealthUrl())!, 200)).toEqual({ documented: true, schema: undefined });
    // Les sessions actives et les rôles ont chacun leur schéma (ils partageaient le nom GetResponseView).
    const sessions = coreApi.match('GET', coreApiUrls.getGetActiveSessionsUrl())!;
    expect(coreApi.responseSchema(sessions, 200)).toEqual({ documented: true, schema: { $ref: '#/components/schemas/GetSessionsResultView' } });
    expect(coreApi.validate(coreApi.schema('GetSessionsResultView'), sessionsResult([session('s-1')]))).toEqual([]);
    // Les erreurs ne sont pas typées par orval : aucun statut hors 2XX n'est documenté.
    expect(coreApi.responseSchema(coreApi.match('POST', coreApiUrls.getLoginUrl())!, 401).documented).toBe(false);
  });
});

describe('Core API fixtures conform to the Core API contract', () => {
  test.each([
    ['login 200', 'post', coreApiUrls.getLoginUrl(), loginResponse()],
    ['getMe 200', 'get', coreApiUrls.getGetMeUrl(), meResponse({ phone: null })],
    ['getUser 200', 'get', coreApiUrls.getGetUserUrl(7), userResponse()],
    ['getGroups 200', 'get', coreApiUrls.getGetGroupsUrl(), groupsResult([group(1), group(2, { description: null })])],
    ['getGroup 200', 'get', coreApiUrls.getGetGroupUrl(5), groupResult(group(5))],
    ['adminGetRole 200', 'get', coreApiUrls.getAdminGetRoleUrl(), rolesResult([role(1), role(2)])],
    ['adminListUsers 200', 'get', coreApiUrls.getAdminListUsersUrl(), adminUsersPage([adminUserRow()])],
    ['history 200', 'get', coreApiUrls.getHistoryUrl(), historyResult([session('s-1'), session('s-2', { revoked_at: '2026-09-16T08:00:00Z' })])],
  ] as const)('%s', (_name, method, url, body) => {
    expect(coreApi.validate(responseSchema(coreApi, method, url, 200), body)).toEqual([]);
  });
});

describe('contract validator', () => {
  test('reports missing required properties, wrong types and minimum', () => {
    const invalid = { roles: [{ ...role(1), id: -1 }, { name: 'Sans id', description: 3 }] };
    expect(coreApi.validate(responseSchema(coreApi, 'get', coreApiUrls.getAdminGetRoleUrl(), 200), invalid)).toEqual(expect.arrayContaining([
      expect.stringContaining('$.roles[0].id: -1 < minimum 0'),
      expect.stringContaining('$.roles[1].id: propriété requise manquante'),
      expect.stringContaining('$.roles[1].description: type string attendu'),
    ]));
  });

  test('matches literal paths before templated ones and validates path parameters and bodies', () => {
    expect(coreApi.match('GET', coreApiUrls.getGetMeUrl())?.template).toBe('/api/v1/user/me/');
    expect(coreApi.match('DELETE', coreApiUrls.getAdminDeleteUserRoleUrl(7, 3))).toMatchObject({
      template: '/api/v1/admin/users/{userId}/roles/{roleId}', pathParams: { userId: '7', roleId: '3' },
    });
    expect(coreApi.validateRequest('GET', new URL('http://core/api/v1/groups/abc/')).errors)
      .toEqual([expect.stringContaining('path.groupId: type number attendu')]);
    const login = coreApi.match('POST', coreApiUrls.getLoginUrl())!;
    expect(coreApi.validate(coreApi.requestBodySchema(login).schema!, { email: 'alice@mairie.test' }))
      .toEqual(expect.arrayContaining([expect.stringContaining('$.password: propriété requise manquante')]));
  });
});
