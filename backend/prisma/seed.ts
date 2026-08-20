/**
 * Dev-only сид: заполняет локальную БД демо-данными, которые невозможно
 * создать через UI (дружба, сообщества, группы — на frontend нет форм для их
 * создания, см. PROJECT_CONTEXT.md backend, раздел «Friends»/«Groups»).
 * НЕ запускается автоматически — только вручную (`npm run seed` /
 * `docker compose exec backend npm run seed`), никогда в production.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'tavern1234';

async function upsertUser(
  email: string,
  name: string,
  extra: Partial<{ tagline: string; city: string; about: string; tags: string[] }> = {},
) {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash, ...extra },
  });
}

async function ensureFriendship(userAId: string, userBId: string) {
  const [a, b] = [userAId, userBId].sort();
  await prisma.friendship.upsert({
    where: { userAId_userBId: { userAId: a, userBId: b } },
    update: {},
    create: { userAId: a, userBId: b },
  });
}

async function ensureFriendRequest(senderId: string, receiverId: string) {
  await prisma.friendRequest.upsert({
    where: { senderId_receiverId: { senderId, receiverId } },
    update: {},
    create: { senderId, receiverId },
  });
}

async function main() {
  const demo = await upsertUser('demo@tavern.local', 'Аля Кравец', {
    tagline: 'держит стол книжных разговоров',
    city: 'Смоленск',
    about: 'Читает вслух по четвергам, всегда рада компании.',
    tags: ['книги', 'чай', 'настолки'],
  });
  const mark = await upsertUser('mark@tavern.local', 'Марк Соснин', {
    tagline: 'варит травяные сборы',
    city: 'Псков',
    tags: ['травы', 'походы'],
  });
  const dina = await upsertUser('dina@tavern.local', 'Дина Волкова', {
    tagline: 'ведёт вечерние настолки',
    city: 'Смоленск',
    tags: ['настолки', 'музыка'],
  });
  const gleb = await upsertUser('gleb@tavern.local', 'Глеб Осокин', {
    tagline: 'заходит редко, но метко',
    city: 'Тверь',
  });
  // Без связей ни с кем — чистая пара для проверки заявок в друзья
  // (отправить/отменить/отклонить) без «автопринятия» встречной заявки.
  await upsertUser('igor@tavern.local', 'Игорь Лаптев', {
    tagline: 'новый гость зала',
    city: 'Казань',
  });

  await ensureFriendship(demo.id, mark.id);
  await ensureFriendship(demo.id, dina.id);
  await ensureFriendship(mark.id, dina.id);
  // Проверяет и «Принять заявку» в разделе «Друзья», и автопринятие, если
  // demo сам отправит заявку глебу (см. FriendsService.sendRequest).
  await ensureFriendRequest(gleb.id, demo.id);

  await prisma.community.upsert({
    where: { name: 'Клуб книжных сов' },
    update: {},
    create: {
      name: 'Клуб книжных сов',
      about: 'Читаем, спорим, пьём чай до полуночи.',
      cover: 'обложка · клуб книжных сов',
      membersCount: 42,
    },
  });
  const herbClub = await prisma.community.upsert({
    where: { name: 'Травники и зельевары' },
    update: {},
    create: {
      name: 'Травники и зельевары',
      about: 'Рецепты сборов, обмен саженцами, разговоры у котла.',
      cover: 'обложка · травники и зельевары',
      membersCount: 17,
    },
  });
  await prisma.community.upsert({
    where: { name: 'Гильдия картографов' },
    update: {},
    create: {
      name: 'Гильдия картографов',
      about: 'Рисуем карты трактов и подземелий, меняемся находками.',
      cover: 'обложка · гильдия картографов',
      membersCount: 9,
    },
  });

  const group = await prisma.group.upsert({
    where: { id: 'seed-group-book-table' },
    update: {},
    create: {
      id: 'seed-group-book-table',
      name: 'Стол книжных вечеров',
      meta: 'закрытый стол · по четвергам',
      mark: '📖',
    },
  });
  await prisma.groupMembership.upsert({
    where: { groupId_userId: { groupId: group.id, userId: demo.id } },
    update: {},
    create: { groupId: group.id, userId: demo.id, role: 'Хранитель стола' },
  });
  await prisma.groupMembership.upsert({
    where: { groupId_userId: { groupId: group.id, userId: dina.id } },
    update: {},
    create: { groupId: group.id, userId: dina.id, role: 'Участник' },
  });

  const trailsGroup = await prisma.group.upsert({
    where: { id: 'seed-group-trail-drafts' },
    update: {},
    create: {
      id: 'seed-group-trail-drafts',
      name: 'Черновики троп',
      meta: 'закрытая группа · планирование походов',
      mark: '🥾',
    },
  });
  await prisma.groupMembership.upsert({
    where: { groupId_userId: { groupId: trailsGroup.id, userId: mark.id } },
    update: {},
    create: { groupId: trailsGroup.id, userId: mark.id, role: 'Проводник' },
  });

  await prisma.post.createMany({
    data: [
      { authorId: dina.id, text: 'Сегодня вечером собираем стол на «Каркассон». Кто с нами?' },
    ],
  });

  const recipePost = await prisma.post.upsert({
    where: { id: 'seed-post-recipe' },
    update: {},
    create: {
      id: 'seed-post-recipe',
      authorId: mark.id,
      text: 'Заварил новый сбор — заходите на стол, пока горячий.',
      // Совпадает с одним комментарием и одним репостом, заведёнными ниже —
      // сид не идёт через PostsService, поэтому счётчики выставлены явно.
      commentsCount: 1,
      repostsCount: 1,
    },
  });
  await prisma.post.upsert({
    where: { id: 'seed-post-herb-map' },
    update: {},
    create: {
      id: 'seed-post-herb-map',
      authorId: demo.id,
      kind: 'communities',
      communityId: herbClub.id,
      text: 'Составила карту зарослей за старым мостом — держите на будущий сбор.',
    },
  });
  await prisma.post.upsert({
    where: { id: 'seed-post-repost-recipe' },
    update: {},
    create: {
      id: 'seed-post-repost-recipe',
      authorId: dina.id,
      repostOfId: recipePost.id,
      text: '',
    },
  });
  await prisma.comment.upsert({
    where: { id: 'seed-comment-recipe' },
    update: {},
    create: {
      id: 'seed-comment-recipe',
      postId: recipePost.id,
      authorId: demo.id,
      text: 'Обязательно попробую, спасибо!',
    },
  });

  // eslint-disable-next-line no-console -- CLI-скрипт, не серверный рантайм: вывод в консоль — ожидаемый UX.
  console.log('Сид применён. Демо-логин: demo@tavern.local / tavern1234');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
