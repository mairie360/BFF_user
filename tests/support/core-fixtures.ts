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

/** Contrat Core API reconstruit depuis le paquet installé : le BFF n'appelle que ses opérations. */
export function loadCoreApiContract(): OpenApiContract {
  return loadOrvalContract('@mairie360/core-api-openapi');
}
