'use client';

import { EMPTY_LINK_TARGET, type LinkTarget, type WebsitePage } from '@/entities/website';
import styles from './LinkField.module.scss';

export interface LinkFieldProps {
  value: LinkTarget | undefined;
  onChange: (value: LinkTarget) => void;
  pages: WebsitePage[];
}

const TARGET_TYPES: { value: LinkTarget['type']; label: string }[] = [
  { value: 'page', label: 'Страница сайта' },
  { value: 'external', label: 'Внешняя ссылка' },
  { value: 'anchor', label: 'Якорь на этой странице' },
  { value: 'phone', label: 'Телефон' },
  { value: 'email', label: 'Почта' },
];

/**
 * Составной контрол для `FieldSchema` с `control: 'link'` — дропдаун
 * выбирает ТИП цели (внешняя ссылка / страница ЭТОГО сайта / якорь /
 * телефон / почта), под ним — единственное поле, нужное именно этому типу.
 * Раньше все эти случаи были одним `control: 'url'`, где «страница сайта»
 * была вообще недостижима (реальных страниц больше одной не было — см.
 * ROADMAP.md Phase 1/2), поэтому ссылка на другую страницу означала
 * буквально вписать её будущий адрес руками и не иметь способа обновить его
 * при переименовании страницы (`resolveLinkHref` в `entities/website/model/
 * resolve-link.ts` решает это, разрешая `pageId` в путь заново при каждом
 * рендере — здесь только форма ввода).
 */
export function LinkField({ value, onChange, pages }: LinkFieldProps) {
  const target = value ?? EMPTY_LINK_TARGET;

  function handleTypeChange(nextType: LinkTarget['type']) {
    if (nextType === 'page') onChange({ type: 'page', pageId: pages[0]?.id ?? '' });
    else if (nextType === 'external') onChange({ type: 'external', url: '' });
    else if (nextType === 'anchor') onChange({ type: 'anchor', anchor: '' });
    else if (nextType === 'phone') onChange({ type: 'phone', phone: '' });
    else onChange({ type: 'email', email: '' });
  }

  return (
    <div className={styles.field}>
      <select
        className={styles.typeSelect}
        value={target.type}
        onChange={(event) => handleTypeChange(event.target.value as LinkTarget['type'])}
      >
        {TARGET_TYPES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {target.type === 'page' &&
        (pages.length > 0 ? (
          <select
            className={styles.valueSelect}
            value={target.pageId}
            onChange={(event) => onChange({ type: 'page', pageId: event.target.value })}
          >
            {pages.map((page, index) => (
              <option key={page.id} value={page.id}>
                {index === 0 ? `${page.title} (главная)` : page.title}
              </option>
            ))}
          </select>
        ) : (
          <p className={styles.hint}>На сайте пока нет ни одной страницы.</p>
        ))}

      {target.type === 'external' && (
        <input
          type="url"
          className={styles.valueInput}
          placeholder="https://…"
          value={target.url}
          onChange={(event) => onChange({ type: 'external', url: event.target.value })}
        />
      )}

      {target.type === 'anchor' && (
        <div className={styles.anchorRow}>
          <span className={styles.anchorPrefix}>#</span>
          <input
            type="text"
            className={styles.valueInput}
            placeholder="contact"
            value={target.anchor}
            onChange={(event) =>
              onChange({ type: 'anchor', anchor: event.target.value.replace(/^#/, '') })
            }
          />
        </div>
      )}

      {target.type === 'phone' && (
        <input
          type="tel"
          className={styles.valueInput}
          placeholder="+7 900 000-00-00"
          value={target.phone}
          onChange={(event) => onChange({ type: 'phone', phone: event.target.value })}
        />
      )}

      {target.type === 'email' && (
        <input
          type="email"
          className={styles.valueInput}
          placeholder="mail@example.com"
          value={target.email}
          onChange={(event) => onChange({ type: 'email', email: event.target.value })}
        />
      )}
    </div>
  );
}
