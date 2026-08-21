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
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageUploadSubdir = 'avatars' | 'covers' | 'gallery' | 'posts' | 'groups';

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
          callback(new BadRequestException('Допустимы только JPEG, PNG и WebP'), '');
          return;
        }
        callback(null, `${randomUUID()}${ext}`);
      },
    }),
    fileFilter: (_req, file, callback) => {
      if (!IMAGE_MIME_EXTENSIONS[file.mimetype]) {
        callback(new BadRequestException('Допустимы только JPEG, PNG и WebP'), false);
        return;
      }
      callback(null, true);
    },
    limits: { fileSize: MAX_IMAGE_BYTES },
  };
}

export function uploadedFileUrl(subdir: ImageUploadSubdir, filename: string): string {
  return `/uploads/${subdir}/${filename}`;
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
