import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

export const ADMIN_POST_TYPE_FILTERS = ['all', 'original', 'repost'] as const;
export type AdminPostTypeFilter = (typeof ADMIN_POST_TYPE_FILTERS)[number];

export const ADMIN_POST_LOCATION_FILTERS = ['all', 'wall', 'group'] as const;
export type AdminPostLocationFilter = (typeof ADMIN_POST_LOCATION_FILTERS)[number];

export class ListAdminPostsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(ADMIN_POST_TYPE_FILTERS)
  type?: AdminPostTypeFilter;

  @IsOptional()
  @IsIn(ADMIN_POST_LOCATION_FILTERS)
  location?: AdminPostLocationFilter;
}
