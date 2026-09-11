import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';

/** `uploads/` — рядом с `src/`, а не внутри него: пользовательские файлы не
 * смешиваются с исходным кодом (см. AGENTS.md backend, раздел про uploads). */
const UPLOADS_ROOT = join(process.cwd(), 'uploads');

const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  // GIF — тот же уровень безопасности, что и у трёх форматов выше (никакой
  // исполняемой поверхности), уже допущен для вложений чата
  // (`CHAT_ATTACHMENT_MIME_EXTENSIONS` ниже) — нет причины запрещать его
  // именно здесь для отдельных subdir'ов (в частности, `ads`).
  'image/gif': '.gif',
};

/** Видео-креатив рекламы (`AdFormat.video`, `AdCreative.videoUrl`) — узкий
 * список форматов, реально проигрываемых `<video>` без транскодирования на
 * сервере (которого в проекте нет и не планируется, см. `MAX_VIDEO_BYTES`).
 * Отдельная карта от `IMAGE_MIME_EXTENSIONS`, а не расширение её — видео и
 * картинка никогда не смешиваются в одном upload-эндпоинте. */
const VIDEO_MIME_EXTENSIONS: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

/** Видео-креатив — короткий автовоспроизводимый безззвучный ролик (реклама),
 * не полноценное видео произвольной длины; лимит выше, чем у изображений
 * (`MAX_IMAGE_BYTES`), но всё ещё ограничен — весь проект хранит медиа на
 * локальном диске без CDN, никакой upload не может быть безразмерным. */
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

/** Вложения чата — шире, чем чистые картинки (см. `createChatAttachmentMulterOptions`
 * ниже): картинки + самые частые «безопасные» типы документов. Осознанно
 * НЕТ svg (может нести скрипт, поэтому его нет и у обычных картинок выше) и
 * никаких исполняемых/скриптовых MIME — только то, что само по себе не
 * выполняется браузером/ОС при открытии. */
const CHAT_ATTACHMENT_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageUploadSubdir =
  | 'avatars'
  | 'covers'
  | 'gallery'
  | 'posts'
  | 'groups'
  | 'messages'
  | 'businesses'
  | 'website'
  | 'products'
  | 'services'
  | 'blog-posts'
  | 'ads'
  | 'stories';

/** Узкий союз ровно с одним сегодняшним вызывающим (`ads`, видео-креатив
 * рекламы) — тот же принцип, что и остальные узкие типы этого файла:
 * расширяется, когда появляется второй реальный вызывающий, не заранее. */
export type VideoUploadSubdir = 'ads';

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Общая конфигурация multer для всех мест, принимающих изображение
 * (аватар/обложка в `UsersController`, галерея в `GalleryController`) —
 * один источник правды вместо трёх копий валидации.
 *
 * Имя файла клиента никогда не используется: расширение выводится из
 * провалидированного MIME (не из оригинального имени), само имя — случайный
 * UUID, поэтому перезаписать чужой файл или подсунуть путь с `../`
 * невозможно.
 */
export function createImageMulterOptions(subdir: ImageUploadSubdir): MulterOptions {
  const destination = join(UPLOADS_ROOT, subdir);
  ensureDir(destination);

  return {
    storage: diskStorage({
      destination,
      filename: (_req, file, callback) => {
        const ext = IMAGE_MIME_EXTENSIONS[file.mimetype];
        if (!ext) {
          callback(new BadRequestException('Допустимы только JPEG, PNG, WebP и GIF'), '');
          return;
        }
        callback(null, `${randomUUID()}${ext}`);
      },
    }),
    fileFilter: (_req, file, callback) => {
      if (!IMAGE_MIME_EXTENSIONS[file.mimetype]) {
        callback(new BadRequestException('Допустимы только JPEG, PNG, WebP и GIF'), false);
        return;
      }
      callback(null, true);
    },
    limits: { fileSize: MAX_IMAGE_BYTES },
  };
}

/**
 * Тот же принцип, что и `createImageMulterOptions` (случайное имя на диске,
 * список MIME — единственная защита), только шире список допустимых типов
 * (`CHAT_ATTACHMENT_MIME_EXTENSIONS`) и всегда `uploads/messages/` — вложения
 * чата не привязаны к конкретной сущности заранее, как аватар/пост.
 * Оригинальное имя файла для отображения в UI (не для диска) остаётся в
 * `file.originalname` — multer сохраняет его независимо от того, что мы
 * подставили в `filename` здесь, отдельно прокидывать не нужно.
 */
export function createChatAttachmentMulterOptions(): MulterOptions {
  const destination = join(UPLOADS_ROOT, 'messages');
  ensureDir(destination);

  return {
    storage: diskStorage({
      destination,
      filename: (_req, file, callback) => {
        const ext = CHAT_ATTACHMENT_MIME_EXTENSIONS[file.mimetype];
        if (!ext) {
          callback(new BadRequestException('Недопустимый тип файла'), '');
          return;
        }
        callback(null, `${randomUUID()}${ext}`);
      },
    }),
    fileFilter: (_req, file, callback) => {
      if (!CHAT_ATTACHMENT_MIME_EXTENSIONS[file.mimetype]) {
        callback(new BadRequestException('Недопустимый тип файла'), false);
        return;
      }
      callback(null, true);
    },
    limits: { fileSize: MAX_IMAGE_BYTES },
  };
}

/**
 * Тот же принцип, что и `createImageMulterOptions` (случайное имя на диске
 * из провалидированного MIME — единственная защита), только для видео-
 * креатива рекламы (`VIDEO_MIME_EXTENSIONS`, `MAX_VIDEO_BYTES`). Отдельная
 * функция, а не ветка внутри `createImageMulterOptions` — видео и картинка
 * никогда не выбираются одним и тем же upload-полем формы.
 */
export function createVideoMulterOptions(subdir: VideoUploadSubdir): MulterOptions {
  const destination = join(UPLOADS_ROOT, subdir);
  ensureDir(destination);

  return {
    storage: diskStorage({
      destination,
      filename: (_req, file, callback) => {
        const ext = VIDEO_MIME_EXTENSIONS[file.mimetype];
        if (!ext) {
          callback(new BadRequestException('Допустимы только MP4 и WebM'), '');
          return;
        }
        callback(null, `${randomUUID()}${ext}`);
      },
    }),
    fileFilter: (_req, file, callback) => {
      if (!VIDEO_MIME_EXTENSIONS[file.mimetype]) {
        callback(new BadRequestException('Допустимы только MP4 и WebM'), false);
        return;
      }
      callback(null, true);
    },
    limits: { fileSize: MAX_VIDEO_BYTES },
  };
}

export function uploadedFileUrl(
  subdir: ImageUploadSubdir | VideoUploadSubdir,
  filename: string,
): string {
  return `/uploads/${subdir}/${filename}`;
}

/** Обратная карта расширение → MIME для `CHAT_ATTACHMENT_MIME_EXTENSIONS`
 * выше — не отдельный список, чтобы формат файла на диске и распознанный
 * MIME не могли разойтись. */
const CHAT_ATTACHMENT_EXTENSION_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(CHAT_ATTACHMENT_MIME_EXTENSIONS).map(([mime, ext]) => [ext, mime]),
);

/** Тот же формат имени, что генерирует `createChatAttachmentMulterOptions`
 * (`randomUUID()` + известное расширение) — используется, чтобы отличить
 * «наш» id вложения от произвольной строки, прежде чем трогать файловую
 * систему по ней (см. `resolveChatAttachmentPath` ниже). */
const CHAT_ATTACHMENT_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|pdf|zip|txt|doc|docx|xls|xlsx)$/;

export function isChatAttachmentId(id: string): boolean {
  return CHAT_ATTACHMENT_FILENAME_PATTERN.test(id);
}

/** MIME вложения чата по его `id` (имени файла на диске) — из расширения,
 * не из значения, которое мог бы прислать клиент: имя файла мы сами
 * присвоили при загрузке (`createChatAttachmentMulterOptions`), поэтому
 * расширение — надёжный источник, а не то, чему клиент решит представиться. */
export function mimeTypeForChatAttachment(id: string): string | undefined {
  const dotIndex = id.lastIndexOf('.');
  if (dotIndex === -1) return undefined;
  return CHAT_ATTACHMENT_EXTENSION_MIME[id.slice(dotIndex)];
}

/**
 * Резолвит `id` вложения AI-чата (`ChatRequestDto.attachmentIds`) в реальный
 * путь на диске — `id` приходит от клиента ЭХОМ того, что мы сами вернули
 * при загрузке (`AiController.uploadAttachment`), поэтому это untrusted
 * input и требует той же defense-in-depth проверки, что `deleteUploadedFile`
 * ниже: строгий формат имени (см. `isChatAttachmentId`) и подтверждение, что
 * резолвленный путь не выходит за пределы каталога вложений, ПРЕЖДЕ чем
 * читать файл. `BadRequestException`, а не `NotFoundException` — с точки
 * зрения пользователя это некорректный/протухший ввод в его же сообщении,
 * не «ресурс не найден» в обычном REST-смысле.
 */
export function resolveChatAttachmentPath(id: string): string {
  if (!isChatAttachmentId(id)) {
    throw new BadRequestException('Некорректный id вложения');
  }

  const attachmentsDir = join(UPLOADS_ROOT, 'messages');
  const absolute = resolve(attachmentsDir, id);
  if (!absolute.startsWith(attachmentsDir) || !existsSync(absolute)) {
    throw new BadRequestException('Вложение не найдено — прикрепите файл заново');
  }

  return absolute;
}

/** Проверка «файл реально пришёл и прошёл валидацию» на уровне контроллера —
 * multer уже отбраковывает недопустимый MIME/размер, но при отсутствии
 * файла в запросе `file` будет `undefined`, и это нужно явно превратить в
 * понятную ошибку, а не 500 при обращении к `file.filename`. */
export function assertUploadedFile(
  file: Express.Multer.File | undefined,
): asserts file is Express.Multer.File {
  if (!file) {
    throw new BadRequestException('Файл не найден в запросе');
  }
}

/** Безопасно удаляет файл по сохранённому относительному URL (`/uploads/...`)
 * — резолвит путь и отказывается трогать что-либо за пределами каталога
 * uploads (защита от path traversal через сохранённый в БД путь). */
export function deleteUploadedFile(url: string | null | undefined): void {
  if (!url || !url.startsWith('/uploads/')) return;

  const relative = url.slice('/uploads/'.length);
  const absolute = resolve(UPLOADS_ROOT, relative);
  if (!absolute.startsWith(UPLOADS_ROOT)) return;

  try {
    if (existsSync(absolute)) unlinkSync(absolute);
  } catch {
    // Файл уже мог быть удалён/недоступен — не валим запрос из-за этого.
  }
}
