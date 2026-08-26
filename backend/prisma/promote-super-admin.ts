/**
 * Разовый bootstrap первого супер-администратора — как и с обычной ролью
 * `admin` (см. `promote-admin.ts`), в приложении сознательно нет self-service
 * способа получить супер-права: их можно выдать только из UI другому уже
 * существующему супер-админу, а первого взять неоткуда, кроме прямого
 * доступа к базе.
 *
 * Заодно выставляет `role: 'admin'`, если его ещё не было — тот же
 * инвариант, что и у `AdminService.setSuperAdmin` в самом приложении.
 *
 * Запуск: `npm run promote-super-admin -- you@example.com`
 * (или `docker compose exec backend npm run promote-super-admin -- you@example.com`).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Использование: npm run promote-super-admin -- you@example.com');
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { role: 'admin', isSuperAdmin: true },
  });
  // eslint-disable-next-line no-console -- CLI-скрипт, не серверный рантайм: вывод в консоль — ожидаемый UX.
  console.log(`${user.name} (${user.email}) теперь супер-администратор.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
