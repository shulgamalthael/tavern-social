'use client';

import { useState } from 'react';
import { updateBusiness } from '@/entities/business';
import type { BusinessCapability } from '@/entities/business';
import { createProduct } from '@/entities/product';
import { createService } from '@/entities/service';
import { BLANK_TEMPLATE_ICON, STARTER_TEMPLATES, useWebsiteBuilderStore } from '@/entities/website';
import type { StarterTemplate } from '@/entities/website';
import styles from './StarterTemplatePicker.module.scss';

export interface StarterTemplatePickerProps {
  businessId: string;
  businessName: string;
  /** Капабилити, уже включённые у бизнеса — чтобы не потерять их при
   * объединении со списком капабилити шаблона (см. `handlePick`). */
  existingCapabilities: string[];
  /** Кнопка «С чистого листа» — блоки уже пустые, поэтому одного
   * `applyTemplate` недостаточно, чтобы скрыть этот экран (см.
   * `WebsiteBuilderWidget.tsx`: пикер показывается по условию
   * `blocks.length === 0`, а не по факту выбора) — родитель прячет пикер
   * сам через локальное состояние. */
  onDismiss: () => void;
  /** Вызывается после того, как шаблон включил капабилити и создал
   * примеры товаров/услуг (см. `StarterTemplate.capabilities`/
   * `seedProducts`/`seedServices`) — родитель должен перечитать профиль
   * бизнеса, иначе Библиотека компонентов ещё не увидит новую капабилити
   * до следующей навигации. Не вызывается для шаблонов без капабилити и
   * для «С чистого листа». */
  onSeeded: () => void;
}

const BlankIcon = BLANK_TEMPLATE_ICON;

/**
 * Полноэкранная заглушка вместо 3-панельного билдера, пока на странице
 * бизнеса нет ни одного блока (первый вход в билдер нового сайта, см.
 * `WebsiteBuilderWidget.tsx` — рендерится вместо `Canvas`/панелей, пока
 * `document.pages[0].blocks.length === 0`). Выбор шаблона наполняет
 * страницу через `store.applyTemplate` (см. `entities/website/model/
 * website-store.ts`) — тот же документ, что уже загружен и автосохраняется,
 * без отдельного запроса на backend.
 *
 * Если у шаблона объявлены `capabilities`/`seedProducts`/`seedServices`
 * (сегодня — только `restaurant`), выбор дополнительно включает эти
 * капабилити и создаёт примеры товаров/услуг настоящими API-вызовами —
 * иначе `productgrid`/`servicegrid` блоки этого же шаблона показывали бы
 * пустой каталог в день создания сайта (см. `templates/index.ts`,
 * `TemplateSeedProduct`/`TemplateSeedService`).
 */
export function StarterTemplatePicker({
  businessId,
  businessName,
  existingCapabilities,
  onDismiss,
  onSeeded,
}: StarterTemplatePickerProps) {
  const applyTemplate = useWebsiteBuilderStore((state) => state.applyTemplate);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  async function handlePick(template: StarterTemplate) {
    if (pendingTemplateId) return;
    setSeedError(null);

    const hasSeedWork =
      Boolean(template.capabilities?.length) ||
      Boolean(template.seedProducts?.length) ||
      Boolean(template.seedServices?.length);

    if (!hasSeedWork) {
      applyTemplate(template.build(businessName));
      return;
    }

    setPendingTemplateId(template.id);
    try {
      if (template.capabilities?.length) {
        const merged = Array.from(new Set([...existingCapabilities, ...template.capabilities]));
        // `StarterTemplate.capabilities` — сырые строки (см. её комментарий в
        // templates/index.ts: entities/website не имеет права импортировать
        // BusinessCapability из entities/business, соседнего слайса того же
        // слоя FSD) — сузить их правильный тип может только backend через
        // `@IsIn(BUSINESS_CAPABILITIES)`, что и происходит на этом PATCH.
        await updateBusiness(businessId, { capabilities: merged as BusinessCapability[] });
      }
      for (const product of template.seedProducts ?? []) {
        await createProduct(businessId, product);
      }
      for (const service of template.seedServices ?? []) {
        await createService(businessId, service);
      }
      onSeeded();
    } catch {
      // Сидинг — удобство, не обязательное условие применения шаблона:
      // блоки данных всё равно рендерятся корректно (просто как пустой
      // каталог, ровно как если бы владелец выбрал шаблон и сам ещё не
      // добавил товары/услуги) — поэтому ошибку показываем, но не
      // блокируем ей применение блоков ниже.
      setSeedError('Не удалось создать примеры товаров/услуг — можно добавить их вручную позже');
    } finally {
      setPendingTemplateId(null);
    }

    applyTemplate(template.build(businessName));
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.intro}>
        <h2 className={styles.intro__title}>С чего начнём?</h2>
        <p className={styles.intro__description}>
          Выберите готовый набор секций под тип бизнеса — потом всё можно поменять, или начните с
          чистого листа.
        </p>
      </div>

      {seedError && (
        <div className={styles.banner} role="alert">
          {seedError}
        </div>
      )}

      <div className={styles.grid}>
        {STARTER_TEMPLATES.map((template) => {
          const Icon = template.icon;
          const isPending = pendingTemplateId === template.id;
          return (
            <button
              key={template.id}
              type="button"
              className={styles.card}
              disabled={pendingTemplateId !== null}
              onClick={() => handlePick(template)}
            >
              <span className={styles.card__icon}>
                <Icon />
              </span>
              <span className={styles.card__label}>{template.label}</span>
              <span className={styles.card__description}>
                {isPending ? 'Настраиваем…' : template.description}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          className={styles.card}
          disabled={pendingTemplateId !== null}
          onClick={onDismiss}
        >
          <span className={styles.card__icon}>
            <BlankIcon />
          </span>
          <span className={styles.card__label}>С чистого листа</span>
          <span className={styles.card__description}>
            Пустая страница — соберите её из блоков сами
          </span>
        </button>
      </div>
    </div>
  );
}
