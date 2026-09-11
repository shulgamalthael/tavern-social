import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type CreatorCategory } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { AdminCreatorCategoryDto, CreatorCategoryNodeDto } from './creators.types';
import type { CreateCreatorCategoryDto } from './dto/create-creator-category.dto';
import type { UpdateCreatorCategoryDto } from './dto/update-creator-category.dto';

/**
 * Иерархическая таксономия деятельности creator'а (AI_PLATFORM_ROADMAP.md
 * §79, второй follow-up владельца) — изначально сидировалась один раз
 * (`prisma/seed-creator-categories.ts`) без admin-CRUD, названо "отложенный
 * nice-to-have" (§79). Закрыто в §84: `create`/`update`/`remove` ниже,
 * `listTree`/`listAll` не тронуты (по-прежнему единственный источник для
 * онбординга/матчинга). Дерево небольшое (десятки строк) — одна
 * `findMany()` без пагинации/лимита, построение дерева в памяти, а не
 * рекурсивный SQL (`WITH RECURSIVE`) ради простоты на этом масштабе.
 */
@Injectable()
export class CreatorCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTree(): Promise<CreatorCategoryNodeDto[]> {
    const rows = await this.prisma.creatorCategory.findMany({ orderBy: { order: 'asc' } });
    return this.buildTree(rows, null);
  }

  /** Плоская карта id → строка — используется `CreatorsService.startOnboarding`
   * для проверки, что присланные id категорий реально существуют, без
   * повторной сборки дерева. */
  async listAll(): Promise<CreatorCategory[]> {
    return this.prisma.creatorCategory.findMany();
  }

  /** Плоский DFS-список для админ-таблицы (`GET admin/creators/categories`)
   * — тот же обход, что `buildTree`, но без вложенности: `depth` даёт
   * фронтенду готовый отступ, не заставляя его строить дерево заново. */
  async listFlatForAdmin(): Promise<AdminCreatorCategoryDto[]> {
    const rows = await this.prisma.creatorCategory.findMany({ orderBy: { order: 'asc' } });
    const result: AdminCreatorCategoryDto[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const row of rows.filter((candidate) => candidate.parentId === parentId)) {
        result.push({
          id: row.id,
          slug: row.slug,
          label: row.label,
          icon: row.icon,
          parentId: row.parentId,
          order: row.order,
          depth,
        });
        walk(row.id, depth + 1);
      }
    };
    walk(null, 0);
    return result;
  }

  async create(dto: CreateCreatorCategoryDto): Promise<AdminCreatorCategoryDto> {
    if (dto.parentId) {
      const parent = await this.prisma.creatorCategory.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) throw new BadRequestException('Родительская категория не найдена');
    }

    try {
      const created = await this.prisma.creatorCategory.create({
        data: {
          slug: dto.slug,
          label: dto.label,
          icon: dto.icon || null,
          parentId: dto.parentId || null,
          order: dto.order ?? 0,
        },
      });
      return this.toAdminDto(created);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async update(id: string, dto: UpdateCreatorCategoryDto): Promise<AdminCreatorCategoryDto> {
    const existing = await this.prisma.creatorCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Категория не найдена');

    let parentId: string | null | undefined;
    if (dto.parentId !== undefined) {
      parentId = dto.parentId || null;
      if (parentId) {
        if (parentId === id) {
          throw new BadRequestException('Категория не может быть родителем самой себя');
        }
        const parent = await this.prisma.creatorCategory.findUnique({ where: { id: parentId } });
        if (!parent) throw new BadRequestException('Родительская категория не найдена');
        await this.assertNotOwnDescendant(id, parent.parentId);
      }
    }

    try {
      const updated = await this.prisma.creatorCategory.update({
        where: { id },
        data: {
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(dto.label !== undefined ? { label: dto.label } : {}),
          ...(dto.icon !== undefined ? { icon: dto.icon || null } : {}),
          ...(parentId !== undefined ? { parentId } : {}),
          ...(dto.order !== undefined ? { order: dto.order } : {}),
        },
      });
      return this.toAdminDto(updated);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  /** Блокирует удаление, пока у категории есть подкатегории — иначе
   * `onDelete: Cascade` (схема) молча снёс бы целое поддерево одним кликом.
   * Назначения creator'ов на эту категорию (`CreatorCategoryAssignment`)
   * при этом каскадно удаляются, как и задумано схемой: creator просто
   * теряет этот тег, без блокировки. */
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.creatorCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Категория не найдена');

    const childCount = await this.prisma.creatorCategory.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new BadRequestException('Сначала удалите или перенесите подкатегории этой категории');
    }

    await this.prisma.creatorCategory.delete({ where: { id } });
  }

  /** Ходит вверх по цепочке `parentId`, начиная от `startParentId` — если
   * встречает `id`, значит новый родитель на самом деле является потомком
   * перемещаемой категории (попытка сделать дерево циклом). */
  private async assertNotOwnDescendant(id: string, startParentId: string | null): Promise<void> {
    let cursor = startParentId;
    while (cursor) {
      if (cursor === id) {
        throw new BadRequestException('Нельзя переместить категорию в собственную подкатегорию');
      }
      const row: { parentId: string | null } | null = await this.prisma.creatorCategory.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = row?.parentId ?? null;
    }
  }

  private mapWriteError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new BadRequestException('Категория с таким slug уже существует');
    }
    return error as Error;
  }

  private toAdminDto(category: CreatorCategory): AdminCreatorCategoryDto {
    return {
      id: category.id,
      slug: category.slug,
      label: category.label,
      icon: category.icon,
      parentId: category.parentId,
      order: category.order,
      depth: 0,
    };
  }

  private buildTree(rows: CreatorCategory[], parentId: string | null): CreatorCategoryNodeDto[] {
    return rows
      .filter((row) => row.parentId === parentId)
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        label: row.label,
        icon: row.icon,
        children: this.buildTree(rows, row.id),
      }));
  }
}
