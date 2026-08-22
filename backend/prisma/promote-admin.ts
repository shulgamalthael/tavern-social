/**
 * Разовый bootstrap первого администратора — в приложении сознательно нет
 * self-service способа получить роль `admin` (см. `UserRole` в
 * `schema.prisma`), поэтому первую (и любую последующую) выдачу роли
 * приходится делать так — вручную, с доступом к базе.
 *
 * Запуск: `npm run promote-admin -- you@example.com`
 * (или `docker compose exec backend npm run promote-admin -- you@example.com`).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Использование: npm run promote-admin -- you@example.com');
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { role: 'admin' },
  });
  // eslint-disable-next-line no-console -- CLI-скрипт, не серверный рантайм: вывод в консоль — ожидаемый UX.
  console.log(`${user.name} (${user.email}) теперь администратор.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
