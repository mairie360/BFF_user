import { z } from 'zod';
import { registry } from '../openapi-registry';

export const AdministrationRoleSchema = registry.register('AdministrationRole', z.object({
  id: z.number(), name: z.string(), description: z.string(), can_be_deleted: z.boolean().nullable().optional(),
}));
export const AdministrationUserSchema = registry.register('AdministrationUser', z.object({
  id: z.number(), first_name: z.string(), last_name: z.string(), email: z.string(), phone_number: z.string().nullable(),
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
