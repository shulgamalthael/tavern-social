import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { deleteUploadedFile } from '@/common/lib/upload';
import type { AppConfig } from '@/config/configuration';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { selectOrphanedUploadUrls, type UploadFileEntry } from './uploads-retention.lib';

const MESSAGES_DIR = join(process.cwd(), 'uploads', 'messages');

/**
 * Подчищает брошенные вложения в `uploads/messages/` — единственный
 * каталог, куда файл может попасть ДО того, как что-либо гарантирует его
 * дальнейшую судьбу (`createChatAttachmentMulterOptions`, `common/lib/
 * upload.ts`, используется и обычным мессенджером, и AI-чатом). У обычного
 * мессенджера (`ThreadsController.sendMessage`) это не проблема — файлы и
 * текст сообщения приходят ОДНИМ запросом, значит либо оба закоммитились,
 * либо (при сбое середины запроса) остался редкий, а не системный сирота.
 * У AI-чата (`AiController.uploadAttachment`) же файл загружается ОТДЕЛЬНЫМ,
 * более ранним запросом — ради мгновенного превью в композере ДО отправки
 * сообщения (AI_PLATFORM_ROADMAP.md §38.3) — и если пользователь просто
 * закрыл вкладку, ничего этот файл никогда не тронет: `AiService.
 * runToolLoop` удаляет вложения только в `finally` УЖЕ ЗАПУЩЕННОГО хода
 * диалога (§38.2), не запущенный ход не оставляет и следа, который можно
 * было бы подчистить сразу. Это ровно тот пробел, что назван в §41.2/
 * `WEBSITE_BUILDER_GAPS.md`: "медленная утечка места на диске, не проблема
 * безопасности" — не срочная, но реальная, и с полностью общим для двух
 * систем каталогом её проще закрыть один раз здесь, чем гадать в каждом
 * месте отдельно.
 *
 * Правило простое и безопасное для обеих систем разом: файл старше TTL
 * (`uploadOrphanTtlHours`, дефолт 24 часа — заведомо больше, чем длится один
 * реальный ход AI-чата) удаляется, ТОЛЬКО если его url не встречается ни в
 * одной строке `MessageAttachment` — то есть ни разу не был частью реально
 * отправленного сообщения. Отправленное сообщение всегда защищено (его url
 * есть в БД), сколько бы ему ни было лет; сирота — либо загруженное для
 * AI-чата вложение, чей ход диалога так и не запустился/не завершился, либо
 * (на практике почти никогда) файл от мессенджера, чей запрос `sendMessage`
 * упал уже после записи файла на диск, но до коммита строки в БД.
 *
 * `setInterval` в `OnModuleInit`, не `@nestjs/schedule` — тот же приём и та
 * же причина, что у `AiCapacityService`/`AiRetentionService` (в проекте нет
 * `@nestjs/schedule`, заводить его ради одного фонового таймера избыточно).
 */
@Injectable()
export class UploadsRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UploadsRetentionService.name);
  private timer: NodeJS.Timeout | undefined;
  private readonly ttlMs: number;
  private readonly intervalMs: number;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    const config = configService.get<AppConfig>('app')!;
    this.ttlMs = config.uploadOrphanTtlHours * 60 * 60_000;
    this.intervalMs = config.uploadOrphanSweepIntervalMs;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.run().catch((error) => {
        this.logger.warn(
          `Не удалось подчистить брошенные вложения: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, this.intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    let entries: string[];
    try {
      entries = readdirSync(MESSAGES_DIR);
    } catch {
      // Каталог ещё не создан — на этом инстансе ни разу не грузили
      // вложение, подчищать нечего (см. `ensureDir` в `common/lib/upload.ts`,
      // каталог создаётся лениво при первой загрузке).
      return;
    }
    if (entries.length === 0) return;

    const files: UploadFileEntry[] = [];
    for (const name of entries) {
      try {
        const { mtimeMs } = statSync(join(MESSAGES_DIR, name));
        files.push({ url: `/uploads/messages/${name}`, mtimeMs });
      } catch {
        // Файл могли удалить между readdirSync и этим statSync (гонка с
        // другим инстансом backend'а или с deleteMessage) — просто пропускаем.
      }
    }
    if (files.length === 0) return;

    const cutoff = Date.now() - this.ttlMs;
    const staleUrls = files.filter((file) => file.mtimeMs < cutoff).map((file) => file.url);
    if (staleUrls.length === 0) return;

    const referenced = await this.prisma.messageAttachment.findMany({
      where: { url: { in: staleUrls } },
      select: { url: true },
    });
    const referencedUrls = new Set(referenced.map((row) => row.url));

    const orphaned = selectOrphanedUploadUrls(files, cutoff, referencedUrls);
    for (const url of orphaned) deleteUploadedFile(url);

    if (orphaned.length > 0) {
      this.logger.debug(
        `Удалено ${orphaned.length} брошенных вложений из uploads/messages (старше ${this.ttlMs / 3_600_000}ч, ни разу не привязаны к отправленному сообщению)`,
      );
    }
  }
}
