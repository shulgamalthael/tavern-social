import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FormSubmission } from '@prisma/client';
import { AnalyticsService } from '@/modules/analytics/analytics.service';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { CreateFormSubmissionDto } from './dto/create-form-submission.dto';
import type { FormSubmissionDto } from './form-submissions.types';

/** Не про производительность — про честность анонимного эндпоинта: без
 * этих пределов кто угодно мог бы прислать `data` с тысячами полей или
 * мегабайтным значением одного поля и раздуть таблицу без предела (тот же
 * класс риска, что `ValidationPipe({ whitelist: true })` закрывает для
 * обычных DTO — но `data` здесь намеренно свободная карта, которую
 * `class-validator` не может ограничить декоратором). */
const MAX_FIELDS = 20;
const MAX_VALUE_LENGTH = 5000;

/** Единственная капабилити-независимая владелец-CRUD сущность в проекте —
 * см. комментарий модели `FormSubmission` в schema.prisma. Заявки только
 * читаются/удаляются владельцем, создаёт их исключительно анонимный
 * посетитель через `PublicSitesController.createFormSubmission` (см. его
 * комментарий — третий и последний анонимный ЗАПИСЫВАЮЩИЙ эндпоинт во всём
 * проекте, после `createOrder`/`createAppointment`). */
@Injectable()
export class FormSubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /** Возвращает `null`, когда honeypot сработал (см. ниже) — "успех" для
   * анонимного клиента (не выдаём боту, что поле распознано), но без строки
   * в БД и БЕЗ срабатывания `form_submitted` (`PublicSitesController`
   * проверяет `null` перед вызовом `RulesService.evaluate` — тот же принцип,
   * что и honeypot сам по себе: боту не за что зацепиться, значит и
   * автоматизация владельца не должна реагировать на фиктивную заявку). */
  async createFromRequest(
    businessId: string,
    dto: CreateFormSubmissionDto,
  ): Promise<FormSubmissionDto | null> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');

    // Бот заполнил honeypot — "успех" без записи, чтобы не выдать, что поле
    // распознано (см. комментарий поля в DTO).
    if (dto.honeypot) return null;

    this.assertValidData(dto.data);

    const row = await this.prisma.formSubmission.create({
      data: {
        businessId,
        formType: dto.formType,
        formLabel: dto.formLabel,
        data: dto.data,
      },
    });
    await this.analyticsService.record(businessId, 'form_submission', { formType: dto.formType });
    return this.toDto(row);
  }

  async list(businessId: string, ownerId: string): Promise<FormSubmissionDto[]> {
    await this.assertOwnership(businessId, ownerId);
    const rows = await this.prisma.formSubmission.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async remove(businessId: string, submissionId: string, ownerId: string): Promise<void> {
    await this.assertOwnership(businessId, ownerId);
    const row = await this.prisma.formSubmission.findUnique({ where: { id: submissionId } });
    if (!row || row.businessId !== businessId) {
      throw new NotFoundException('Заявка не найдена');
    }
    await this.prisma.formSubmission.delete({ where: { id: submissionId } });
  }

  private async assertOwnership(businessId: string, ownerId: string): Promise<void> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { ownerId: true },
    });
    if (!business) throw new NotFoundException('Бизнес не найден');
    if (business.ownerId !== ownerId) throw new ForbiddenException('Это не ваш бизнес');
  }

  private assertValidData(data: Record<string, string>): void {
    const entries = Object.entries(data);
    if (entries.length === 0 || entries.length > MAX_FIELDS) {
      throw new BadRequestException('Некорректное количество полей формы');
    }
    for (const [label, value] of entries) {
      if (typeof label !== 'string' || label.length === 0 || label.length > 200) {
        throw new BadRequestException('Некорректная подпись поля формы');
      }
      if (typeof value !== 'string' || value.length > MAX_VALUE_LENGTH) {
        throw new BadRequestException('Слишком длинное значение поля формы');
      }
    }
  }

  private toDto(row: FormSubmission): FormSubmissionDto {
    return {
      id: row.id,
      businessId: row.businessId,
      formType: row.formType,
      formLabel: row.formLabel,
      data: row.data as Record<string, string>,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
