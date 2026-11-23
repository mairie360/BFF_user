import { z } from 'zod';
import { registry } from '../openapi-registry';

export const AdministrationRoleSchema = registry.register('AdministrationRole', z.object({
  id: z.number(), name: z.string(), description: z.string(), can_be_deleted: z.boolean().nullable().optional(),
}));
export const AdministrationUserSchema = registry.register('AdministrationUser', z.object({
  id: z.number(), first_name: z.string(), last_name: z.string(), email: z.string(), phone_number: z.string().nullable(),
  phone_country: z.string().nullable().optional(),
  status: z.string(), is_archived: z.boolean(), roles: z.array(AdministrationRoleSchema.pick({ id: true, name: true })),
  // MAIR-584 / MAIR-824: what the user list of the administration shows on each row.
  account_status: z.enum(['active', 'invited', 'inactive', 'suspended']).openapi({ description: 'State shown by the administration: active, invited (never signed in), inactive (archived) or suspended.', example: 'active' }),
  active_sessions: z.number().int().nonnegative().openapi({ description: 'Sessions still open (neither revoked nor expired): the user is shown online when above 0.', example: 2 }),
  last_login_at: z.string().nullable().openapi({ description: 'Last sign-in (opening of the latest session), RFC 3339 UTC, null when the user never signed in.', example: '2026-11-20T08:42:11Z' }),
  two_factor: z.object({
    methods: z.array(z.enum(['totp', 'passkey', 'backup_codes'])).openapi({ description: 'Second-factor methods the user enrolled; empty when none.', example: ['totp', 'backup_codes'] }),
    last_verified_at: z.string().nullable().openapi({ description: 'Latest successful second-factor verification, RFC 3339 UTC, or null.', example: '2026-11-20T08:42:30Z' }),
  }).openapi('AdministrationUserTwoFactor', { description: 'Second factor of the user (security tab of the administration), never a secret.' }),
}));
export const AdministrationUsersPageSchema = registry.register('AdministrationUsersPage', z.object({
  users: z.array(AdministrationUserSchema), page: z.number(), page_size: z.number(), total: z.number(), total_pages: z.number(),
}));
export const AdministrationGroupSchema = registry.register('AdministrationGroup', z.object({
  id: z.number(), name: z.string(), description: z.string().nullable(), owner_id: z.number(),
}));
export const AdministrationGroupMemberSchema = registry.register('AdministrationGroupMember', AdministrationUserSchema.omit({ roles: true, account_status: true, active_sessions: true, last_login_at: true, two_factor: true }));
export const AdministrationSessionSchema = registry.register('AdministrationSession', z.object({
  id: z.string(), device_info: z.string(), ip_address: z.string(), created_at: z.string(), expires_at: z.string(), revoked_at: z.string().nullable(),
}));
// Sessions of one user, newest first, read by an administrator (MAIR-584): active and ended ones.
export const AdministrationUserSessionsSchema = registry.register('AdministrationUserSessions', z.object({
  sessions: z.array(AdministrationSessionSchema).openapi({ description: 'The latest 100 sessions of the user, newest first; active ones have `revoked_at` null and `expires_at` in the future.' }),
}));

// Instance policy of the second factor (MAIR-808), as Core serves it.
export const TwoFactorPolicySchema = registry.register('TwoFactorPolicy', z.object({
  required: z.boolean().openapi({ description: 'Every agent must hold a second factor: an agent without one enrols at its next sign-in, before any session opens.', example: true }),
  totp_allowed: z.boolean().openapi({ description: 'Authenticator application (TOTP) accepted.', example: true }),
  passkey_allowed: z.boolean().openapi({ description: 'Passkeys accepted. A PUT with true answers 400 while the instance has no WebAuthn configuration (MAIR-810).', example: false }),
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

// A project of BFF_Project left without a group (created before groups were required, or its group was deleted).
export const AdministrationProjectWithoutGroupSchema = registry.register('AdministrationProjectWithoutGroup', z.object({
    id: z.string().openapi({ description: 'Id of the project in BFF_Project', example: 'project-9' }),
    title: z.string().openapi({ example: 'LED street lighting' }),
    createdAt: z.string().nullable().openapi({ description: 'Creation date (ISO 8601), `null` when unknown', example: '2026-03-03T09:12:00+00:00' }),
}));
export const AdministrationProjectsWithoutGroupSchema = registry.register('AdministrationProjectsWithoutGroup', z.object({
    total: z.number().int().nonnegative(),
    projects: z.array(AdministrationProjectWithoutGroupSchema).openapi({ description: 'Newest first; empty when every project has a group' }),
}));
