import { Golos_Text, JetBrains_Mono, Lora } from 'next/font/google';

export const fontUi = Golos_Text({
  variable: '--font-ui',
  subsets: ['latin', 'cyrillic'],
});

export const fontDisplay = Lora({
  variable: '--font-display',
  subsets: ['latin', 'cyrillic'],
});

export const fontMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});
