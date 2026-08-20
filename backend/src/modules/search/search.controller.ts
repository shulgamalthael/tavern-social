import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import type { RequestUser } from '@/common/types/authenticated-request';
import { SearchQueryDto } from './dto/search-query.dto';
import type { SearchResultDto } from './search.types';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(SessionAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async search(
    @CurrentUser() currentUser: RequestUser,
    @Query() query: SearchQueryDto,
  ): Promise<SearchResultDto> {
    return this.searchService.search(currentUser.id, query.q.trim(), query.limit);
  }
}
