import { createHmac } from 'node:crypto';
import { AxiosHeaders, type AxiosResponse, type RawAxiosResponseHeaders } from 'axios';
import { getCoreAPIMairie360 } from '@mairie360/core-api-openapi/endpoints/coreAPIMairie360';
import type {
  AdminGetRolesResultView,
  AdminListUsersResultView,
  AdminUserRow,
  GetGroupResultView,
  GetGroupUsersResultView,
  GetGroupsResultView,
  GetMeResponseView,
  GetSessionsResultView,
  GetUserResponseView,
  Group,
  HistoryResponseView,
  LoginResponseView,
  PostGroupResultView,
  Role,
  SessionSchema,
} from '@mairie360/core-api-openapi/model';
import type { OpenApiContract } from './openapi-contract';
import { loadOrvalContract } from './orval-contract';

// Réponses Core API typées par les modèles du paquet @mairie360/core-api-openapi installé : un champ ajouté,
// retiré ou renommé par le contrat fait échouer la compilation des tests. Elles sont en plus validées à
// l'exécution contre le contrat reconstruit (upstream-contracts.test.ts, mock HTTP). Jetons de session des tests.

/** Chemins des opérations Core API, tels que les construit le client généré (helpers `get*Url`). */
export const coreApiUrls = getCoreAPIMairie360();

/** Réponse axios complète telle que la renvoie le client généré (`*Result`), pour les mocks de module. */
export function axiosResponse<T>(data: T, status = 200, headers: RawAxiosResponseHeaders = {}): AxiosResponse<T> {
  return { data, status, statusText: 'OK', headers, config: { headers: new AxiosHeaders() } };
}

export function group(id: number, overrides: Partial<Group> = {}): Group {
  return { id, name: `Groupe ${id}`, description: `Description ${id}`, owner_id: 1, ...overrides };
}

export const groupsResult = (groups: Group[]): GetGroupsResultView => ({ groups });
export const groupResult = (found: Group): GetGroupResultView => ({ group: found });
export const groupMembers = (users: number[]): GetGroupUsersResultView => ({ users });
export const postGroupResult = (id: number): PostGroupResultView => ({ id });

export function role(id: number, overrides: Partial<Role> = {}): Role {
  return { id, name: `Rôle ${id}`, description: `Description du rôle ${id}`, ...overrides };
}

export const rolesResult = (roles: Role[]): AdminGetRolesResultView => ({ roles });

export function session(id: string, overrides: Partial<SessionSchema> = {}): SessionSchema {
  return {
    id,
    device_info: 'Firefox',
    ip_address: '127.0.0.1',
    created_at: '2026-09-15T08:00:00Z',
    expires_at: '2026-09-22T08:00:00Z',
    revoked_at: null,
    ...overrides,
  };
}

export const sessionsResult = (sessions: SessionSchema[]): GetSessionsResultView => ({ sessions });
export const historyResult = (sessions: SessionSchema[]): HistoryResponseView => ({ sessions });

export function meResponse(overrides: Partial<GetMeResponseView> = {}): GetMeResponseView {
  return {
    email: 'alice@mairie.test',
    first_name: 'Alice',
    last_name: 'Martin',
    phone: '+33123456789',
    role: 'Admin',
    status: 'active',
    groups: [group(1)],
    ...overrides,
  };
}

export function userResponse(overrides: Partial<GetUserResponseView> = {}): GetUserResponseView {
  return { ...meResponse(), is_archived: false, ...overrides };
}

export const loginResponse = (refresh_token = 'opaque-refresh-token'): LoginResponseView => ({ refresh_token });

export function adminUserRow(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: 1,
    first_name: 'Admin',
    last_name: 'User',
    email: 'admin@mairie360.fr',
    phone_number: null,
    status: 'active',
    is_archived: false,
    roles: [{ id: 1, name: 'Admin' }],
    ...overrides,
  };
}

/** Page de `GET /api/v1/admin/users/` (AdminListUsersResultView). */
export function adminUsersPage(users: AdminUserRow[], overrides: Partial<AdminListUsersResultView> = {}): AdminListUsersResultView {
  return { users, page: 1, page_size: 20, total: users.length, total_pages: users.length === 0 ? 0 : 1, ...overrides };
}

export const JWT_SECRET = 'contract-test-secret';

/** JWT HS256 signé avec JWT_SECRET : `requireAdmin` le vérifie localement, Core API (simulée) le reçoit tel quel. */
export function sessionToken(userId: number, secret = JWT_SECRET, expiresIn = 3_600): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: String(userId), exp: Math.floor(Date.now() / 1000) + expiresIn })).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export const expiredToken = (userId: number) => sessionToken(userId, JWT_SECRET, -60);

/** Contrat Core API reconstruit depuis le paquet installé : le BFF n'appelle que ses opérations. */
export function loadCoreApiContract(): OpenApiContract {
  return loadOrvalContract('@mairie360/core-api-openapi');
}
