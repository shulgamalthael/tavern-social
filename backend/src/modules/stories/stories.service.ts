import {
  ForbiddenException,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Story, User } from '@prisma/client';
import { deleteUploadedFile } from '@/common/lib/upload';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { FriendsService } from '@/modules/friends/friends.service';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';
import { UsersService } from '@/modules/users/users.service';
import type { StoryDto, StoryGroupDto, StoryViewerEntryDto } from './stories.types';

/** Продуктовое правило «история живёт сутки» — не настраиваемая
 * инфраструктурная TTL (как у `UploadsRetentionService`), поэтому просто
 * константа в файле, а не поле конфига. */
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
/** Как часто фоновый таймер реально удаляет протухшие строки/файлы — сама
 * видимость истории гейтится фильтром выборки (`cutoff()` ниже) на каждый
 * запрос независимо от того, когда в последний раз пробегал sweep. */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

type StoryWithRelations = Story & { author: User; views: { viewerId: string }[] };

@Injectable()
export class StoriesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StoriesService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly friendsService: FriendsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.sweepExpired().catch((error) => {
        this.logger.warn(
          `Не удалось подчистить протухшие истории: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, SWEEP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private cutoff(): Date {
    return new Date(Date.now() - STORY_LIFETIME_MS);
  }

  private toStoryDto(story: StoryWithRelations, viewerId: string): StoryDto {
    return {
      id: story.id,
      imageUrl: story.imageUrl,
      createdAt: story.createdAt.toISOString(),
      isMine: story.authorId === viewerId,
      isViewedByMe:
        story.authorId === viewerId || story.views.some((view) => view.viewerId === viewerId),
    };
  }

  private groupByAuthor(stories: StoryWithRelations[], viewerId: string): StoryGroupDto[] {
    const groups = new Map<string, StoryGroupDto>();
    for (const story of stories) {
      let group = groups.get(story.authorId);
      if (!group) {
        group = {
          author: this.usersService.toPublicProfile(story.author),
          stories: [],
          hasUnseen: false,
        };
        groups.set(story.authorId, group);
      }
      const dto = this.toStoryDto(story, viewerId);
      group.stories.push(dto);
      if (!dto.isMine && !dto.isViewedByMe) group.hasUnseen = true;
    }
    return Array.from(groups.values());
  }

  /** Своя группа — всегда первая (вызывающий, `getTray`, гарантирует, что
   * она уже есть в `groups`, даже пустым `stories: []`, чтобы фронт мог
   * нарисовать тайл «+»), остальные — сначала непросмотренные, затем по
   * свежести последней истории. */
  private sortTray(groups: StoryGroupDto[], viewerId: string): StoryGroupDto[] {
    const own = groups.find((group) => group.author.id === viewerId);
    const others = groups
      .filter((group) => group.author.id !== viewerId)
      .sort((a, b) => {
        if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
        const aLatest = a.stories.at(-1)?.createdAt ?? '';
        const bLatest = b.stories.at(-1)?.createdAt ?? '';
        return bLatest.localeCompare(aLatest);
      });
    return own ? [own, ...others] : others;
  }

  async getTray(viewerId: string): Promise<StoryGroupDto[]> {
    const [friendIds, followingIds] = await Promise.all([
      this.friendsService.getFriendIds(viewerId),
      this.subscriptionsService.getFollowingIds(viewerId),
    ]);
    const authorIds = [viewerId, ...friendIds, ...followingIds];

    const stories = (await this.prisma.story.findMany({
      where: { authorId: { in: authorIds }, createdAt: { gt: this.cutoff() } },
      include: { author: true, views: { where: { viewerId }, select: { viewerId: true } } },
      orderBy: { createdAt: 'asc' },
    })) as StoryWithRelations[];

    const groups = this.groupByAuthor(stories, viewerId);
    const ownProfile = groups.find((group) => group.author.id === viewerId);
    if (!ownProfile) {
      const viewer = await this.usersService.findByIdOrThrow(viewerId);
      groups.push({
        author: this.usersService.toPublicProfile(viewer),
        stories: [],
        hasUnseen: false,
      });
    }
    return this.sortTray(groups, viewerId);
  }

  async getForUser(userId: string, viewerId: string): Promise<StoryGroupDto> {
    const user = await this.usersService.findByIdOrThrow(userId);
    await this.usersService.assertCanViewRestrictedContent(user, viewerId);

    const stories = (await this.prisma.story.findMany({
      where: { authorId: userId, createdAt: { gt: this.cutoff() } },
      include: { author: true, views: { where: { viewerId }, select: { viewerId: true } } },
      orderBy: { createdAt: 'asc' },
    })) as StoryWithRelations[];

    const [group] = this.groupByAuthor(stories, viewerId);
    return (
      group ?? { author: this.usersService.toPublicProfile(user), stories: [], hasUnseen: false }
    );
  }

  async create(authorId: string, imageUrl: string): Promise<StoryDto> {
    const story = await this.prisma.story.create({
      data: { authorId, imageUrl },
      include: { author: true, views: { select: { viewerId: true } } },
    });
    return this.toStoryDto(story, authorId);
  }

  async markViewed(storyId: string, viewerId: string): Promise<void> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: { author: { select: { id: true, isPrivate: true } } },
    });
    if (!story || story.createdAt < this.cutoff()) return;
    if (story.authorId === viewerId) return;

    await this.usersService.assertCanViewRestrictedContent(story.author, viewerId);
    await this.prisma.storyView.upsert({
      where: { storyId_viewerId: { storyId, viewerId } },
      create: { storyId, viewerId },
      update: {},
    });
  }

  async getViewers(storyId: string, authorId: string): Promise<StoryViewerEntryDto[]> {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story || story.authorId !== authorId) {
      throw new ForbiddenException('Список просмотревших виден только автору истории');
    }

    const views = await this.prisma.storyView.findMany({
      where: { storyId },
      include: { viewer: true },
      orderBy: { viewedAt: 'desc' },
    });
    return views.map((view) => ({
      viewer: this.usersService.toPublicProfile(view.viewer),
      viewedAt: view.viewedAt.toISOString(),
    }));
  }

  async remove(storyId: string, authorId: string): Promise<void> {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story || story.authorId !== authorId) {
      throw new ForbiddenException('Удалить историю может только её автор');
    }
    await this.prisma.story.delete({ where: { id: storyId } });
    deleteUploadedFile(story.imageUrl);
  }

  async sweepExpired(): Promise<void> {
    const expired = await this.prisma.story.findMany({
      where: { createdAt: { lt: this.cutoff() } },
      select: { id: true, imageUrl: true },
    });
    if (expired.length === 0) return;

    await this.prisma.story.deleteMany({ where: { id: { in: expired.map((story) => story.id) } } });
    for (const story of expired) deleteUploadedFile(story.imageUrl);

    this.logger.debug(`Удалено ${expired.length} протухших историй (старше 24ч)`);
  }
}
