import { useCurrentUser } from '@/entities/user';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { CloseIcon, LocationIcon, MessagesIcon } from '@/shared/ui/icons';
import { IdBadge } from '@/shared/ui/IdBadge';
import { Tag } from '@/shared/ui/Tag';
import type { Friend } from '../model/types';
import styles from './FriendCard.module.scss';

export interface FriendCardProps {
  friend: Friend;
  onMessage?: () => void;
  /** Клик по аватару/имени — переход на страницу друга, отдельно от
   * остальных действий карточки (см. AGENTS.md, клики по автору). */
  onAuthorClick?: (friendId: string) => void;
  /** Разрыв дружбы — показывается только там, где вызывающий явно передал
   * колбэк (см. `widgets/friends/ui/FriendsWidget`). */
  onRemove?: () => void;
}

/** Больше тегов карточка просто не показывает — сворачивает остаток в один
 * бейдж `+N`, чтобы плотный список интересов не разваливал карточку в сетке
 * (в отличие от прежней однострочной раскладки, здесь ширина ограничена). */
const MAX_VISIBLE_TAGS = 4;

export function FriendCard({ friend, onMessage, onAuthorClick, onRemove }: FriendCardProps) {
  const { currentUser } = useCurrentUser();
  const hiddenTagsCount = friend.tags.length - MAX_VISIBLE_TAGS;

  return (
    <Card as="article" className={styles.friend}>
      <div className={styles.friend__header}>
        <button
          type="button"
          className={styles['friend__avatar-trigger']}
          onClick={() => onAuthorClick?.(friend.id)}
        >
          <Avatar
            initials={friend.initials}
            src={friend.avatarUrl}
            size="xl"
            online={friend.here}
          />
        </button>
        <button
          type="button"
          className={styles['friend__name-trigger']}
          onClick={() => onAuthorClick?.(friend.id)}
        >
          <span className={styles.friend__name}>{friend.name}</span>
        </button>
        {/* Всегда в разметке, даже без заметки — `.friend__note` резервирует
         * высоту одной строки сам (см. `FriendCard.module.scss`), иначе
         * карточки без заметки были бы на строку ниже соседних в той же
         * сетке (см. `widgets/friends/ui/FriendsWidget.module.scss`,
         * `.friends__grid` — растягивает карточки только внутри одного
         * ряда, не по всей плитке). */}
        <span className={styles.friend__note}>{friend.note}</span>
        {currentUser.role === 'admin' && <IdBadge id={friend.id} label="Пользователь" />}
        <span className={styles.friend__status}>
          <span
            className={cn(
              styles['friend__status-dot'],
              friend.here && styles['friend__status-dot--online'],
            )}
            aria-hidden="true"
          />
          <span className={styles['friend__status-text']}>{friend.status}</span>
        </span>
      </div>

      {/* Тот же приём, что у заметки выше — блок остаётся в разметке даже
       * без текста «о себе», `min-height` в CSS держит место всех 3 строк
       * клампа независимо от того, сколько реально текста поместилось. */}
      <p className={styles.friend__about}>{friend.about}</p>

      <div className={styles.friend__facts}>
        {friend.city && (
          <span className={styles.friend__fact}>
            <LocationIcon />
            <span className={styles['friend__fact-text']}>{friend.city}</span>
          </span>
        )}
        <span className={styles.friend__fact}>
          <span className={styles['friend__fact-text']}>{friend.mutual}</span>
        </span>
        <span className={styles.friend__fact}>
          <span className={styles['friend__fact-text']}>{friend.since}</span>
        </span>
      </div>

      {/* Ряд тегов тоже всегда в разметке — без этого карточка без тегов
       * теряла бы целую строку высоты относительно соседей. Когда тегов
       * нет, кладём один `Tag` с `visibility: hidden` вместо того, чтобы
       * подбирать точную высоту чипа вручную (padding/line-height и так
       * заданы в `Tag.module.scss`) — невидимый, но настоящий чип всегда
       * даёт точно такую же высоту, какую дал бы видимый. */}
      <div className={styles.friend__tags}>
        {friend.tags.length > 0 ? (
          <>
            {friend.tags.slice(0, MAX_VISIBLE_TAGS).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
            {hiddenTagsCount > 0 && <Tag>+{hiddenTagsCount}</Tag>}
          </>
        ) : (
          <Tag className={styles['friend__tags-placeholder']} aria-hidden>
            placeholder
          </Tag>
        )}
      </div>

      <div className={styles.friend__actions}>
        <Button variant="soft" fullWidth onClick={onMessage}>
          <MessagesIcon />
          Написать
        </Button>
        {onRemove && (
          <Button
            variant="ghost"
            className={styles['friend__remove']}
            onClick={onRemove}
            aria-label="Удалить из друзей"
            title="Удалить из друзей"
          >
            <CloseIcon />
          </Button>
        )}
      </div>
    </Card>
  );
}
