import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SessionAuthGuard } from '@/common/guards/session-auth.guard';
import {
  assertUploadedFile,
  createImageMulterOptions,
  deleteUploadedFile,
  uploadedFileUrl,
} from '@/common/lib/upload';
import type { RequestUser } from '@/common/types/authenticated-request';
import { MediaAssetsService } from '@/modules/media-assets/media-assets.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import type { ProductDto } from './products.types';
import { ProductsService } from './products.service';

/** Вложено под `/businesses/:businessId/products` — товар не существует без
 * бизнеса, тот же принцип, что у `WebsitesController` (см. её комментарий).
 * Публичное чтение витрины живёт отдельно, в `PublicSitesController`
 * (`GET /sites/:businessId/products`) — этот контроллер целиком owner-only. */
@Controller('businesses/:businessId/products')
@UseGuards(SessionAuthGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly mediaAssetsService: MediaAssetsService,
  ) {}

  @Get()
  list(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
  ): Promise<ProductDto[]> {
    return this.productsService.list(businessId, currentUser.id);
  }

  @Post()
  create(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateProductDto,
  ): Promise<ProductDto> {
    return this.productsService.create(businessId, currentUser.id, dto);
  }

  @Patch(':productId')
  update(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductDto> {
    return this.productsService.update(businessId, productId, currentUser.id, dto);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
  ): Promise<void> {
    return this.productsService.remove(businessId, productId, currentUser.id);
  }

  /** Тот же приём, что `WebsitesController.uploadAsset`: multer уже
   * записал файл на диск раньше тела метода, поэтому при отказе владения
   * подчищаем его, а не оставляем висеть ничьей ссылкой. Возвращает только
   * URL — сам товар (`images: [...url]`) сохраняет отдельный `PATCH`,
   * фото товара не льётся напрямую в БД одним запросом с остальными полями,
   * потому что файл и JSON-тело нельзя отправить одной формой без
   * multipart-парсинга всего DTO (тот же компромисс, что и у логотипа
   * бизнеса). */
  @Post('images')
  @UseInterceptors(FileInterceptor('file', createImageMulterOptions('products')))
  async uploadImage(
    @CurrentUser() currentUser: RequestUser,
    @Param('businessId') businessId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ url: string }> {
    assertUploadedFile(file);
    const url = uploadedFileUrl('products', file.filename);
    try {
      await this.productsService.assertOwnership(businessId, currentUser.id);
    } catch (error) {
      deleteUploadedFile(url);
      throw error;
    }
    await this.mediaAssetsService.record(businessId, url, file.mimetype);
    return { url };
  }
}
