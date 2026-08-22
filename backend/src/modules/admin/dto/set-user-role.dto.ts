import { IsIn } from 'class-validator';

export const ASSIGNABLE_USER_ROLES = ['user', 'admin'] as const;
export type AssignableUserRole = (typeof ASSIGNABLE_USER_ROLES)[number];

export class SetUserRoleDto {
  @IsIn(ASSIGNABLE_USER_ROLES, { message: 'Роль должна быть "user" или "admin"' })
  role!: AssignableUserRole;
}
