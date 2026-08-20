import { Injectable, NotFoundException } from '@nestjs/common';
import type { GalleryImage } from '@prisma/client';
import { deleteUploadedFile } from '@/common/lib/upload';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { GalleryImageDto } from './gallery.types';

@Injectable()
export class GalleryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<GalleryImageDto[]> {
    const images = await this.prisma.galleryImage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return images.map((image) => this.toDto(image));
  }

  async add(userId: string, url: string): Promise<GalleryImageDto> {
    const image = await this.prisma.galleryImage.create({ data: { userId, url } });
    return this.toDto(image);
  }

  /** Файл на диске удаляется вместе со строкой — иначе он остаётся сиротой
   * в uploads/gallery навсегда (см. common/lib/upload.ts). Не найдено/не
   * принадлежит вызывающему — одна и та же 404, чтобы не палить чужие id. */
  async remove(userId: string, imageId: string): Promise<void> {
    const image = await this.prisma.galleryImage.findUnique({ where: { id: imageId } });
    if (!image || image.userId !== userId) {
      throw new NotFoundException('Изображение не найдено');
    }

    await this.prisma.galleryImage.delete({ where: { id: imageId } });
    deleteUploadedFile(image.url);
  }

  private toDto(image: GalleryImage): GalleryImageDto {
    return {
      id: image.id,
      url: image.url,
      createdAt: image.createdAt.toISOString(),
    };
  }
}
