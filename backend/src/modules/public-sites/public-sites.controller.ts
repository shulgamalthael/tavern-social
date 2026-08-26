import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from '@/modules/analytics/analytics.service';
import { CreateAppointmentDto } from '@/modules/appointments/dto/create-appointment.dto';
import type { AppointmentDto } from '@/modules/appointments/appointments.types';
import { AppointmentsService } from '@/modules/appointments/appointments.service';
import { BlogPostsService } from '@/modules/blog-posts/blog-posts.service';
import type { PublicBlogPostDto } from '@/modules/blog-posts/blog-posts.types';
import { CouponPreviewDto } from '@/modules/discounts/dto/coupon-preview.dto';
import type { CouponPreviewResult } from '@/modules/discounts/discounts.types';
import { DiscountsService } from '@/modules/discounts/discounts.service';
import { DomainResolverService } from '@/modules/domains/domain-resolver.service';
import type { ResolvedSiteDto } from '@/modules/domains/domains.types';
import { CreateFormSubmissionDto } from '@/modules/form-submissions/dto/create-form-submission.dto';
import { FormSubmissionsService } from '@/modules/form-submissions/form-submissions.service';
import { CreateOrderDto } from '@/modules/orders/dto/create-order.dto';
import type { OrderDto } from '@/modules/orders/orders.types';
import { OrdersService } from '@/modules/orders/orders.service';
import { ProductsService } from '@/modules/products/products.service';
import type { PublicProductDto } from '@/modules/products/products.types';
import { ServicesService } from '@/modules/services/services.service';
import type { PublicServiceDto } from '@/modules/services/services.types';
import { WebsitesService } from '@/modules/websites/websites.service';
import type { WebsitePublicDto } from '@/modules/websites/websites.types';

/**
 * Единственный по-настоящему анонимный контроллер сайтов — без
 * `SessionAuthGuard` (см. корневой план задачи, раздел «MVP Domain Flow»):
 * посетитель `coffee.com` не обязан иметь аккаунт в Таверне вообще, в
 * отличие от `/business/[id]` внутри приложения (там — владелец/участник
 * Таверны, см. `WebsitesController.getPublic`, `@UseGuards(SessionAuthGuard)`
 * на уровне класса). Два раздельных пути к одному и тому же
 * `WebsitesService.getPublic` — сознательно: не ослабляем защищённый
 * маршрут ради этого, а добавляем отдельный, честно публичный.
 *
 * `resolve` вызывает Next.js middleware на edge (см. `frontend/src/proxy.ts`)
 * на каждый запрос к домену, кроме собственного домена приложения — только
 * hostname → businessId, без содержимого сайта (маленький и быстрый ответ).
 * `getPublicSite` отдаёт уже сами данные — вызывается со страницы `/site/
 * [businessId]`, на которую middleware переписывает запрос.
 */
@Controller('sites')
export class PublicSitesController {
  constructor(
    private readonly domainResolver: DomainResolverService,
    private readonly websitesService: WebsitesService,
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService,
    private readonly servicesService: ServicesService,
    private readonly appointmentsService: AppointmentsService,
    private readonly blogPostsService: BlogPostsService,
    private readonly formSubmissionsService: FormSubmissionsService,
    private readonly analyticsService: AnalyticsService,
    private readonly discountsService: DiscountsService,
  ) {}

  @Get('resolve')
  async resolve(@Query('hostname') hostname?: string): Promise<ResolvedSiteDto> {
    if (!hostname) throw new BadRequestException('Не передан hostname');

    const resolved = await this.domainResolver.resolve(hostname);
    if (!resolved) throw new NotFoundException('Сайт с таким адресом не найден');

    return { businessId: resolved.businessId };
  }

  /** Единственное место в проекте, где записывается `'page_view'` (см.
   * `AnalyticsService`/комментарий модели `AnalyticsEvent`) — намеренно
   * именно здесь, а не внутри `WebsitesService.getPublic`: тот же метод
   * сервиса вызывает и `WebsitesController.getPublic` (`/businesses/
   * :businessId/website/public`), внутренний preview владельца изнутри
   * Таверны — считать его "просмотром сайта" задвоило бы счётчик каждым
   * открытием собственного сайта владельцем, поэтому запись живёт в
   * контроллере, у по-настоящему анонимного входа, а не в общей логике. */
  @Get(':businessId')
  async getPublicSite(@Param('businessId') businessId: string): Promise<WebsitePublicDto> {
    const site = await this.websitesService.getPublic(businessId);
    await this.analyticsService.record(businessId, 'page_view');
    return site;
  }

  /** Витрина каталога для блока `productgrid` (см. `entities/website/blocks/
   * commerce`) — по-настоящему анонимно, без проверки владения (тот же
   * принцип, что и у `getPublicSite` выше): только активные товары, ничего
   * из владельческого `ProductDto` сверх того, что видно на витрине (см.
   * `ProductsService.listPublic`/`PublicProductDto`). Отдельный путь, а не
   * параметр у `getPublicSite`, потому что виджет каталога дозагружает
   * товары независимо от остального документа сайта (см. компонент
   * `ProductGridRenderer` — свой `useAsyncData`, не общий с `PublicSiteWidget`). */
  @Get(':businessId/products')
  getPublicProducts(@Param('businessId') businessId: string): Promise<PublicProductDto[]> {
    return this.productsService.listPublic(businessId);
  }

  /** Оформление заказа с анонимной витрины (см. `entities/cart`/`Checkout`
   * блок на frontend) — без сессии Таверны, тот же принцип, что и у
   * остального этого контроллера. Цена и название каждой позиции
   * пересчитываются на backend из актуального `Product` (см.
   * `OrdersService.createFromCart`), не берутся из тела запроса — иначе
   * анонимный клиент мог бы прислать любую цену. `@Throttle` — один из
   * немногих ЗАПИСЫВАЮЩИХ анонимных эндпоинтов во всём проекте (создаёт
   * реальную запись в БД без какой-либо аутентификации, см. также
   * `createAppointment`/`createFormSubmission` ниже), поэтому лимит
   * заметно строже, чем у остальных публичных `GET` здесь. */
  @Post(':businessId/orders')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createOrder(
    @Param('businessId') businessId: string,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderDto> {
    return this.ordersService.createFromCart(businessId, dto);
  }

  /** Предпросмотр промокода (Pricing Engine, Phase 17, см.
   * `PRICING_ARCHITECTURE.md` §5) — вызывается корзиной ДО оформления
   * заказа, чтобы показать "Применено ✓ / Промокод не найден" сразу, не
   * дожидаясь сабмита всей формы. НЕ резервирует использование и НЕ
   * является источником истины для реального списания — оно пересчитывается
   * заново, независимо, в `createOrder` ниже. Тот же более строгий
   * `@Throttle`, что и у остальных анонимных ЗАПИСЫВАЮЩИХ... — на самом деле
   * это чтение, но обращается к БД по произвольному введённому коду, тот же
   * риск перебора кодов, что и у любого анонимного поиска по секрету. */
  @Post(':businessId/coupons/preview')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  previewCoupon(
    @Param('businessId') businessId: string,
    @Body() dto: CouponPreviewDto,
  ): Promise<CouponPreviewResult> {
    return this.discountsService.preview(businessId, dto.code, dto.subtotalCents);
  }

  /** Витрина услуг для блока `servicegrid` (см. `entities/website/blocks/
   * booking`) — тот же принцип, что и `getPublicProducts`. */
  @Get(':businessId/services')
  getPublicServices(@Param('businessId') businessId: string): Promise<PublicServiceDto[]> {
    return this.servicesService.listPublic(businessId);
  }

  /** Заявка на запись с анонимной витрины — тот же принцип, что и
   * `createOrder`: цена/название/длительность пересчитываются на backend из
   * актуальной `Service`, не берутся из тела запроса. Тот же более строгий
   * `@Throttle`, что и у заказов. */
  @Post(':businessId/appointments')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createAppointment(
    @Param('businessId') businessId: string,
    @Body() dto: CreateAppointmentDto,
  ): Promise<AppointmentDto> {
    return this.appointmentsService.createFromRequest(businessId, dto);
  }

  /** Отправка формы (`contactform`/`newsletterform`/`simpleform`, см.
   * `entities/website/blocks/forms` на frontend) с анонимной витрины —
   * единственный анонимный ЗАПИСЫВАЮЩИЙ путь, у которого нет капабилити:
   * формы доступны любому бизнесу без включения `Business.capabilities`
   * (см. комментарий модели `FormSubmission` в schema.prisma). Тот же
   * более строгий `@Throttle`, что и у заказов/записей — третий и
   * последний анонимный ЗАПИСЫВАЮЩИЙ эндпоинт во всём проекте. Возвращает
   * `204` без тела — форме на frontend нечего показать в ответе, только
   * факт успеха/ошибки (см. `FormBlock.tsx`). */
  @Post(':businessId/form-submissions')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  createFormSubmission(
    @Param('businessId') businessId: string,
    @Body() dto: CreateFormSubmissionDto,
  ): Promise<void> {
    return this.formSubmissionsService.createFromRequest(businessId, dto);
  }

  /** Витрина постов блога для блока `bloggrid` (см. `entities/website/
   * blocks/content`) и списочной страницы `/site/[businessId]/blog` на
   * frontend — тот же принцип, что и `getPublicProducts`/`getPublicServices`.
   * Никакого анонимного эндпоинта на запись для блога нет вообще — посты
   * пишет только владелец (см. комментарий `BlogPostsService`). */
  @Get(':businessId/blog-posts')
  getPublicBlogPosts(@Param('businessId') businessId: string): Promise<PublicBlogPostDto[]> {
    return this.blogPostsService.listPublic(businessId);
  }

  /** Один пост по slug — для страницы чтения `/site/[businessId]/blog/
   * [postSlug]`. 404, если поста с таким slug нет ИЛИ он не опубликован —
   * оба случая для анонимного посетителя должны выглядеть одинаково (см.
   * `BlogPostsService.getPublicBySlug`, возвращает `null` для обоих). */
  @Get(':businessId/blog-posts/:slug')
  async getPublicBlogPostBySlug(
    @Param('businessId') businessId: string,
    @Param('slug') slug: string,
  ): Promise<PublicBlogPostDto> {
    const post = await this.blogPostsService.getPublicBySlug(businessId, slug);
    if (!post) throw new NotFoundException('Пост не найден');
    return post;
  }
}
