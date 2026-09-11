/**
 * Сидирует иерархическую таксономию `CreatorCategory` (AI_PLATFORM_ROADMAP.md
 * §79, второй follow-up владельца) — В ОТЛИЧИЕ от `seed.ts`, это не dev-only
 * демо-данные: без этого дерева Creator-онбординг (обязательный выбор
 * категории) невозможен вообще ни в одном окружении, включая production.
 * Безопасно перезапускать (upsert по `slug`) — не создаёт дублей, не трогает
 * `CreatorCategoryAssignment` уже существующих creator'ов (их `categoryId`
 * продолжает указывать на ту же строку).
 *
 * Дерево — ровно те категории и подкатегории, что владелец привёл как
 * примеры в самой постановке задачи (§3 корневого плана фичи); подкатегории
 * заведены только там, где владелец сам их назвал (Technology, Gaming) — не
 * придумываем детализацию для остальных, пока не появится реальный запрос.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CategorySeed {
  slug: string;
  label: string;
  icon?: string;
  children?: CategorySeed[];
}

const CATEGORIES: CategorySeed[] = [
  {
    slug: 'gaming',
    label: 'Gaming',
    icon: '🎮',
    children: [
      { slug: 'pc-gaming', label: 'PC Gaming' },
      { slug: 'console-gaming', label: 'Console Gaming' },
      { slug: 'mobile-gaming', label: 'Mobile Gaming' },
      { slug: 'esports', label: 'Esports' },
      { slug: 'game-development', label: 'Game Development' },
    ],
  },
  {
    slug: 'technology',
    label: 'Technology',
    icon: '💻',
    children: [
      {
        slug: 'ai',
        label: 'AI',
        children: [{ slug: 'generative-ai', label: 'Generative AI' }],
      },
      { slug: 'programming', label: 'Programming' },
      { slug: 'gadgets', label: 'Gadgets' },
      { slug: 'cybersecurity', label: 'Cybersecurity' },
      { slug: 'startups', label: 'Startups' },
    ],
  },
  { slug: 'fashion', label: 'Fashion', icon: '👗' },
  { slug: 'beauty', label: 'Beauty', icon: '💄' },
  { slug: 'food', label: 'Food', icon: '🍔' },
  { slug: 'travel', label: 'Travel', icon: '✈️' },
  { slug: 'fitness-sport', label: 'Fitness & Sport', icon: '🏋️' },
  { slug: 'education', label: 'Education', icon: '📚' },
  { slug: 'finance', label: 'Finance', icon: '💰' },
  { slug: 'automotive', label: 'Automotive', icon: '🚗' },
  { slug: 'music', label: 'Music', icon: '🎵' },
  { slug: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { slug: 'lifestyle', label: 'Lifestyle', icon: '🏠' },
  { slug: 'family-parenting', label: 'Family & Parenting', icon: '👶' },
  { slug: 'business', label: 'Business', icon: '💼' },
  { slug: 'creator-digital-content', label: 'Creator / Digital Content', icon: '📱' },
  { slug: 'art-design', label: 'Art & Design', icon: '🎨' },
  { slug: 'science', label: 'Science', icon: '🔬' },
  { slug: 'news-media', label: 'News & Media', icon: '📰' },
  { slug: 'other', label: 'Other' },
];

async function upsertCategory(
  seed: CategorySeed,
  parentId: string | null,
  order: number,
): Promise<void> {
  const category = await prisma.creatorCategory.upsert({
    where: { slug: seed.slug },
    update: { label: seed.label, icon: seed.icon ?? null, parentId, order },
    create: { slug: seed.slug, label: seed.label, icon: seed.icon ?? null, parentId, order },
  });

  for (const [index, child] of (seed.children ?? []).entries()) {
    await upsertCategory(child, category.id, index);
  }
}

async function main() {
  for (const [index, category] of CATEGORIES.entries()) {
    await upsertCategory(category, null, index);
  }
  console.warn(`Seeded ${CATEGORIES.length} top-level creator categories.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
