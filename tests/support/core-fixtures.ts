import { createHmac } from 'node:crypto';
import type { OpenApiContract } from './openapi-contract';
import { loadOrvalContract } from './orval-contract';

// Réponses Core API conformes au contrat du paquet @mairie360/core-api-openapi installé
// (validées dans upstream-contracts.test.ts) et jetons de session des tests.

export function group(id: number, overrides: Partial<{ name: string; description: string | null; owner_id: number }> = {}) {
  return { id, name: `Groupe ${id}`, description: `Description ${id}`, owner_id: 1, ...overrides };
}

export function role(id: number, overrides: Partial<{ name: string; description: string }> = {}) {
  return { id, name: `Rôle ${id}`, description: `Description du rôle ${id}`, ...overrides };
}

export function session(id: string, overrides: Partial<{ revoked_at: string | null }> = {}) {
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

export function meResponse(overrides: Partial<{ role: string; phone: string | null; groups: Array<ReturnType<typeof group>> }> = {}) {
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

export function userResponse(overrides: Partial<{ phone: string | null; is_archived: boolean }> = {}) {
  return { ...meResponse(), is_archived: false, ...overrides };
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

/**
 * Opérations réellement servies par Core API v1.1.1 mais absentes (ou autrement nommées) du paquet orval publié.
 * Le mock refuse toute route hors contrat : ces écarts sont donc ajoutés au contrat reconstruit, chacun justifié.
 * upstream-contracts.test.ts vérifie qu'ils existent toujours dans le paquet : quand il échoue, retirer l'entrée.
 */
export const CORE_CONTRACT_GAPS = [
  {
    method: 'delete',
    template: '/api/v1/admin/users/{userId}/',
    // Core_API src/endpoints/v1/admin/users/id/delete/endpoint.rs : `#[delete("/")]` documenté avec `path = ""`,
    // si bien que cargo open_api ne l'exporte pas ; src/clients/coreClient.ts l'appelle donc sans client généré.
    reason: 'DELETE /api/v1/admin/users/{userId}/ existe dans Core API mais pas dans le contrat publié',
    operation: {
      operationId: 'adminDeleteUser',
      parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'number' } }],
      responses: { '2XX': { description: 'Utilisateur supprimé (204) ou déjà supprimé (200)' } },
    },
  },
  {
    method: 'post',
    template: '/api/v1/auth/force_change_password',
    // Core API sert `#[post("/force_change_password")]` sans slash final alors que le contrat publié le déclare avec :
    // l'intercepteur de src/clients/coreClient.ts retire le slash, l'opération est la même.
    reason: 'POST /api/v1/auth/force_change_password est déclaré avec un slash final que Core API ne sert pas',
    aliasOf: '/api/v1/auth/force_change_password/',
  },
] as const;

export function loadCoreApiContract(): OpenApiContract {
  const contract = loadOrvalContract('@mairie360/core-api-openapi');
  const paths = contract.document.paths as Record<string, Record<string, unknown>>;
  for (const gap of CORE_CONTRACT_GAPS) {
    const operation = 'aliasOf' in gap ? paths[gap.aliasOf]?.[gap.method] : gap.operation;
    if (!operation) throw new Error(`Écart de contrat sans opération source : ${gap.reason}`);
    paths[gap.template] = { ...paths[gap.template], [gap.method]: operation };
  }
  return contract;
}
