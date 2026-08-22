import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

export const ADMIN_USER_ROLE_FILTERS = ['all', 'user', 'admin'] as const;
export type AdminUserRoleFilter = (typeof ADMIN_USER_ROLE_FILTERS)[number];

export const ADMIN_USER_STATUS_FILTERS = ['all', 'active', 'banned'] as const;
export type AdminUserStatusFilter = (typeof ADMIN_USER_STATUS_FILTERS)[number];

export class ListAdminUsersDto extends PaginationQueryDto {
  /** Поиск по имени/email, тот же приём (`contains`, `insensitive`), что и в
   * `SearchService` — не полнотекстовый индекс, таблица пользователей не
   * настолько велика, чтобы это было узким местом. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(ADMIN_USER_ROLE_FILTERS)
  role?: AdminUserRoleFilter;

  @IsOptional()
  @IsIn(ADMIN_USER_STATUS_FILTERS)
  status?: AdminUserStatusFilter;
}
