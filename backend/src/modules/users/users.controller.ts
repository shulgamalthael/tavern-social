import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { MAX_PAGINATION_LIMIT, PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import { assertUploadedFile, createImageMulterOptions, uploadedFileUrl } from '@/common/lib/upload';
import type { RequestUser } from '@/common/types/authenticated-request';
import type { PaginatedDto } from '@/common/types/paginated';
import { BusinessesService } from '@/modules/businesses/businesses.service';
import { CreatorsService } from '@/modules/creators/creators.service';
import type { FriendDto } from '@/modules/friends/friends.types';
import { FriendsService } from '@/modules/friends/friends.service';
import type { SubscriberDto } from '@/modules/subscriptions/subscriptions.types';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import type { MeProfile, UserProfileDto } from './users.types';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(SessionAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly friendsService: FriendsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly creatorsService: CreatorsService,
    private readonly businessesService: BusinessesService,
  ) {}

  @Get('me')
  async me(@CurrentUser() currentUser: RequestUser): Promise<MeProfile> {
    const user = await this.usersService.findByIdOrThrow(currentUser.id);
    return this.withCounts(this.usersService.toMeProfile(user), currentUser.id);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<MeProfile> {
    const user = await this.usersService.updateProfile(currentUser.id, dto);
    return this.withCounts(this.usersService.toMeProfile(user), currentUser.id);
  }

  // Оба маршрута — только `me`, без `:id` — владение структурно гарантировано
  // самим маршрутом, как и у PATCH /users/me выше.
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', createImageMulterOptions('avatars')))
  async uploadAvatar(
    @CurrentUser() currentUser: RequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MeProfile> {
    assertUploadedFile(file);
    const user = await this.usersService.setAvatar(
      currentUser.id,
      uploadedFileUrl('avatars', file.filename),
    );
    return this.withCounts(this.usersService.toMeProfile(user), currentUser.id);
  }

  @Post('me/cover')
  @UseInterceptors(FileInterceptor('file', createImageMulterOptions('covers')))
  async uploadCover(
    @CurrentUser() currentUser: RequestUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MeProfile> {
    assertUploadedFile(file);
    const user = await this.usersService.setCover(
      currentUser.id,
      uploadedFileUrl('covers', file.filename),
    );
    return this.withCounts(this.usersService.toMeProfile(user), currentUser.id);
  }

  @Patch('me/settings')
  async updateSettings(
    @CurrentUser() currentUser: RequestUser,
    @Body() dto: UpdateSettingsDto,
  ): Promise<MeProfile> {
    const user = await this.usersService.updateSettings(currentUser.id, dto);
    return this.withCounts(this.usersService.toMeProfile(user), currentUser.id);
  }

  /** Домешивает `followersCount`/`followingCount`/`friendsCount` в любой
   * ответ, возвращающий `MeProfile` — счётчики требуют запроса к
   * `Subscription`/`Friendship` (§85), а `toMeProfile` сам остаётся чистой
   * функцией (см. её комментарий в `users.mapper.ts`). */
  private async withCounts(
    profile: Omit<MeProfile, 'followersCount' | 'followingCount' | 'friendsCount'>,
    userId: string,
  ): Promise<MeProfile> {
    const [followersCount, followingCount, friendsCount] = await Promise.all([
      this.subscriptionsService.countFollowers(userId),
      this.subscriptionsService.countFollowing(userId),
      this.friendsService.countFriends(userId),
    ]);
    return { ...profile, followersCount, followingCount, friendsCount };
  }

  // Должен идти после статичных маршрутов `me`/`me/settings` — Nest
  // сопоставляет маршруты в порядке объявления, и `:id` иначе перехватил бы их.
  @Get(':id')
  async getById(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
  ): Promise<UserProfileDto> {
    const user = await this.usersService.findByIdOrThrow(id);
    // `friendship`/`subscription`/счётчики нужны всегда — верхний блок
    // приватного профиля показывает «N подписчиков · M подписок · K друзей»
    // некликабельными цифрами даже без доступа к остальному контенту (по
    // просьбе продукта), это не то же самое, что сами списки (см.
    // `getFriends`/`getFollowers`/`getFollowing` ниже — те по-прежнему
    // требуют `canViewFullProfile`).
    const [
      friendship,
      subscription,
      canViewFullProfile,
      followersCount,
      followingCount,
      friendsCount,
    ] = await Promise.all([
      this.friendsService.getStatus(currentUser.id, id),
      this.subscriptionsService.getStatus(currentUser.id, id),
      this.usersService.canViewRestrictedContent(user, currentUser.id),
      this.subscriptionsService.countFollowers(id),
      this.subscriptionsService.countFollowing(id),
      this.friendsService.countFriends(id),
    ]);

    const restricted = canViewFullProfile
      ? await this.loadRestrictedProfileData(id)
      : { creatorStatus: null, businesses: [] };

    const publicProfile = this.usersService.toPublicProfile(user);
    return {
      ...publicProfile,
      // Верхний блок (имя/тэглайн/аватар/обложка) остаётся из publicProfile
      // как есть; about/tags — уже часть PublicProfile, но это «остальной
      // контент» (§103), поэтому прячем их отдельно, когда доступа нет.
      about: canViewFullProfile ? publicProfile.about : null,
      tags: canViewFullProfile ? publicProfile.tags : [],
      role: user.role,
      friendship,
      subscription,
      isPrivate: user.isPrivate,
      canViewFullProfile,
      followersCount,
      followingCount,
      friendsCount,
      ...restricted,
    };
  }

  /** Бейдж creator'а/бизнесы — единственный оставшийся «остальной контент»
   * приватного профиля (§103), запрашивается только когда
   * `canViewFullProfile`, чтобы не бить по БД впустую ради значений, которые
   * всё равно не покажутся. Счётчики (followers/following/friends) сюда
   * больше не входят — они видны всегда, см. `getById`. */
  private async loadRestrictedProfileData(
    id: string,
  ): Promise<Pick<UserProfileDto, 'creatorStatus' | 'businesses'>> {
    const [creatorStatus, ownedBusinesses] = await Promise.all([
      this.creatorsService.getStatusForUser(id),
      this.businessesService.list(id),
    ]);
    return {
      creatorStatus,
      businesses: ownedBusinesses
        .filter((business) => business.status === 'published')
        .map((business) => ({ id: business.id, name: business.name })),
    };
  }

  // Список друзей ЧУЖОГО профиля — тот же доступ, что у GET /users/:id и
  // GET /users/:id/gallery: любой залогиненный, если профиль не приватный
  // или у зрителя есть к нему доступ (§103, `assertCanViewRestrictedContent`).
  // `FriendsService.list` уже принимает произвольный userId — раньше просто
  // не вызывался ни с чьим, кроме своего.
  //
  // Не курсорная пагинация, а один запрос с максимальным лимитом: этот список
  // питает виджет профиля (9 плиток + модалка с клиентским поиском по уже
  // загруженному списку, см. `widgets/profile/ProfileFriendsCard`/
  // `FriendsListModal`) — поиск по частично догруженному списку молча не
  // находил бы часть друзей, а полноценный серверный поиск здесь избыточен
  // для масштаба этого приложения. Бесконечный скролл — только на отдельной
  // полноценной странице «Друзья» (`GET /friends`, свой список).
  @Get(':id/friends')
  async getFriends(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
  ): Promise<FriendDto[]> {
    const user = await this.usersService.findByIdOrThrow(id);
    await this.usersService.assertCanViewRestrictedContent(user, currentUser.id);
    const { items } = await this.friendsService.list(id, undefined, MAX_PAGINATION_LIMIT);
    return items;
  }

  // Курсорная пагинация (не единый максимальный запрос, как у `getFriends`
  // выше) — подписчики/подписки ничем не ограничены в отличие от друзей
  // (§85), список может быть намного больше, чем помещается в один ответ.
  @Get(':id/followers')
  async getFollowers(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDto<SubscriberDto>> {
    const user = await this.usersService.findByIdOrThrow(id);
    await this.usersService.assertCanViewRestrictedContent(user, currentUser.id);
    return this.subscriptionsService.listFollowers(id, query.cursor, query.limit);
  }

  @Get(':id/following')
  async getFollowing(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedDto<SubscriberDto>> {
    const user = await this.usersService.findByIdOrThrow(id);
    await this.usersService.assertCanViewRestrictedContent(user, currentUser.id);
    return this.subscriptionsService.listFollowing(id, query.cursor, query.limit);
  }
}
