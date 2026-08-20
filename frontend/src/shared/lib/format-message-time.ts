/** «14:32» — время сообщения в чате, как в Telegram (не относительное «N минут назад»). */
export function formatMessageTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}
