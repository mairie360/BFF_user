import { z } from 'zod';
import { registry } from '../openapi-registry';

export const AdministrationRoleSchema = registry.register('AdministrationRole', z.object({
  id: z.number(), name: z.string(), description: z.string(), can_be_deleted: z.boolean().nullable().optional(),
}));
// Answer of Core POST /api/v1/admin/keycloak/console-access (MAIR-609): a single-use link to the Keycloak console.
export const KeycloakConsoleAccessSchema = registry.register('KeycloakConsoleAccess', z.object({
  url: z.string().url().openapi({
    description: 'Single-use link to open in a new tab, on the Keycloak host: it sets the 30-minute console cookie and redirects to the realm admin console.',
    example: 'https://auth.dev.mairie360-eip.fr/admin-access?token=<link token>',
  }),
  expires_in: z.number().int().positive().openapi({ description: 'Seconds before the link expires (120).', example: 120 }),
}));
export const AdministrationUserSchema = registry.register('AdministrationUser', z.object({
  id: z.number(), first_name: z.string(), last_name: z.string(), email: z.string(), phone_number: z.string().nullable(),
  phone_country: z.string().nullable().optional(),
  status: z.string(), is_archived: z.boolean(), roles: z.array(AdministrationRoleSchema.pick({ id: true, name: true })),
}));
export const AdministrationUsersPageSchema = registry.register('AdministrationUsersPage', z.object({
  users: z.array(AdministrationUserSchema), page: z.number(), page_size: z.number(), total: z.number(), total_pages: z.number(),
}));
export const AdministrationGroupSchema = registry.register('AdministrationGroup', z.object({
  id: z.number(), name: z.string(), description: z.string().nullable(), owner_id: z.number(),
}));
export const AdministrationGroupMemberSchema = registry.register('AdministrationGroupMember', AdministrationUserSchema.omit({ roles: true }));
export const AdministrationSessionSchema = registry.register('AdministrationSession', z.object({
  id: z.string(), device_info: z.string(), ip_address: z.string(), created_at: z.string(), expires_at: z.string(), revoked_at: z.string().nullable(),
}));

// Instance policy of the second factor (MAIR-808), as Core serves it.
export const TwoFactorPolicySchema = registry.register('TwoFactorPolicy', z.object({
  required: z.boolean().openapi({ description: 'Every agent must hold a second factor: an agent without one enrols at its next sign-in, before any session opens.', example: true }),
  totp_allowed: z.boolean().openapi({ description: 'Authenticator application (TOTP) accepted.', example: true }),
  passkey_allowed: z.boolean().openapi({ description: 'Passkeys accepted. Always false until the passkey feature ships (a PUT with true answers 400).', example: false }),
  backup_codes_allowed: z.boolean().openapi({ description: 'Backup codes accepted at the second step.', example: true }),
  updated_by: z.number().nullable().openapi({ description: 'Id of the administrator who last changed the policy, null for the initial one.', example: 1 }),
  updated_at: z.string().openapi({ description: 'ISO 8601 date of the last change.', example: '2026-11-17T09:30:00Z' }),
}));
export const TwoFactorPolicyUpdateSchema = registry.register('TwoFactorPolicyUpdate', z.object({
  required: z.boolean().openapi({ example: true }),
  totp_allowed: z.boolean().openapi({ example: true }),
  passkey_allowed: z.boolean().openapi({ example: false }),
  backup_codes_allowed: z.boolean().openapi({ example: true }),
}).strict());
