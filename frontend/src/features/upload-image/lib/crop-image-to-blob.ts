import type { Area } from 'react-easy-crop';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Не удалось загрузить изображение')));
    image.src = src;
  });
}

/**
 * Рисует выбранную область кропа на offscreen-canvas и экспортирует итоговый
 * `Blob` — именно он уходит на сервер, а не исходный файл целиком (см.
 * AGENTS.md: после crop на сервер отправляется обработанная версия).
 */
export async function cropImageToBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен в этом браузере');

  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Не удалось обработать изображение'));
      },
      'image/jpeg',
      0.92,
    );
  });
}
