import type { Metadata, Viewport } from 'next';
import { fontDisplay, fontMono, fontUi } from '@/shared/config/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Таверна',
  description:
    'Тёплая тёмная соцсеть: лента, диалоги, друзья, сообщества и группы за общим столом.',
};

/** Полностью запрещаем зум страницы (pinch и авто-зум iOS при фокусе на
 * поле ввода с маленьким шрифтом) — мобильное приложение уже адаптивное,
 * зум только ломает раскладку. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ru" className={`${fontUi.variable} ${fontDisplay.variable} ${fontMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
