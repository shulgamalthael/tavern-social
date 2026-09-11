'use client';

import { useEffect, useMemo, useState } from 'react';
import { SubscriptionRequestCard, useFollowRequestsStore } from '@/entities/follow';
import {
  type Friend,
  FriendCard,
  FriendCardSkeleton,
  FriendRequestCard,
  useFriendStore,
} from '@/entities/friend';
import { useThreadStore } from '@/entities/thread';
import { useNavigationStore } from '@/features/section-navigation';
import { cn } from '@/shared/lib/cn';
import { useInfiniteScroll } from '@/shared/lib/use-infinite-scroll';
import { Badge } from '@/shared/ui/Badge';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SearchIcon } from '@/shared/ui/icons';
import { Loader } from '@/shared/ui/Loader';
import { PageHead } from '@/shared/ui/PageHead';
import { SectionContainer } from '@/shared/ui/SectionContainer';
import styles from './FriendsWidget.module.scss';

const FRIENDS_SKELETON_COUNT = 6;

type FriendsTab = 'friends' | 'requests';

/**
 * Раздел «Друзья» — две вкладки вместо прежней единственной ленты, где
 * заявки просто вставлялись сверху над сеткой друзей, если они вообще были.
 * Разделение по тому же принципу, что у Discord/VK/Facebook: «кого я уже
 * знаю» — самостоятельная задача (найти, написать), «что требует моего
 * решения» (входящие/исходящие заявки) — другая, и обе не должны толкаться
 * в одной прокрутке. Счётчик на вкладке «Заявки» — та же цифра, что и на
 * бейдже пункта «Друзья» в `NavigationDock` (`selectPendingIncomingRequests
 * Count`), только здесь считает оба направления сразу (сколько строк
 * реально покажет вкладка), а не только входящие (сколько требует ответа
 * именно от вас).
 */
export function FriendsWidget() {
  const goToUserProfile = useNavigationStore((state) => state.goToUserProfile);
  const goToSection = useNavigationStore((state) => state.goToSection);
  const openDirectThreadWith = useThreadStore((state) => state.openDirectThreadWith);

  const friends = useFriendStore((state) => state.friends);
  const status = useFriendStore((state) => state.status);
  const error = useFriendStore((state) => state.error);
  const loadFriends = useFriendStore((state) => state.loadFriends);
  const nextCursor = useFriendStore((state) => state.nextCursor);
  const loadMoreStatus = useFriendStore((state) => state.loadMoreStatus);
  const loadMoreFriends = useFriendStore((state) => state.loadMoreFriends);
  const incoming = useFriendStore((state) => state.incoming);
  const outgoing = useFriendStore((state) => state.outgoing);
  const requestsStatus = useFriendStore((state) => state.requestsStatus);
  const requestsError = useFriendStore((state) => state.requestsError);
  const loadRequests = useFriendStore((state) => state.loadRequests);
  const acceptRequest = useFriendStore((state) => state.acceptRequest);
  const removeRequest = useFriendStore((state) => state.removeRequest);
  const removeFriend = useFriendStore((state) => state.removeFriend);
  const sentinelRef = useInfiniteScroll(nextCursor, () => void loadMoreFriends());

  // Заявки на подписку к приватному профилю (§103) — отдельный store от
  // `useFriendStore` (`entities/follow`, не `entities/friend`), показываются
  // вторым блоком той же вкладки «Заявки» по решению продукта: это тоже
  // «что требует моего решения», отдельная страница ради одного блока была бы
  // избыточной.
  const followIncoming = useFollowRequestsStore((state) => state.incoming);
  const followOutgoing = useFollowRequestsStore((state) => state.outgoing);
  const followRequestsStatus = useFollowRequestsStore((state) => state.status);
  const followRequestsError = useFollowRequestsStore((state) => state.error);
  const loadFollowRequests = useFollowRequestsStore((state) => state.loadRequests);
  const acceptFollowRequest = useFollowRequestsStore((state) => state.acceptRequest);
  const removeFollowRequest = useFollowRequestsStore((state) => state.removeRequest);

  const [tab, setTab] = useState<FriendsTab>('friends');
  const [query, setQuery] = useState('');

  useEffect(() => {
    void loadFriends();
    void loadRequests();
    void loadFollowRequests();
    // Один раз при заходе в раздел — дальше store поддерживает себя сам
    // (действия ниже и real-time события в app/home-app.tsx). Заявки уже
    // грузятся ещё раньше, при монтировании всего приложения (см.
    // `app/home-app.tsx` — нужно бейджу в навигации), поэтому здесь этот
    // вызов часто просто подтверждает уже свежие данные — дёшево, зато не
    // приходится городить условие «а не загружено ли уже».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMessage = (friend: Friend) => {
    goToSection('messages');
    openDirectThreadWith({
      id: friend.id,
      name: friend.name,
      initials: friend.initials,
      avatarUrl: friend.avatarUrl,
    });
  };

  const requestsCount =
    incoming.length + outgoing.length + followIncoming.length + followOutgoing.length;

  // Поиск чисто клиентский, по уже загруженной странице (тот же приём, что
  // и в `FriendsListModal`) — сервер не поддерживает поиск по друзьям, а
  // заводить его ради вкладки на 240px карточки было бы избыточно для
  // масштаба этого приложения. Сознательный компромисс: пока не долистали
  // курсорную пагинацию до конца, поиск не видит ещё не подгруженных
  // друзей — про это явно говорит текст пустого состояния ниже, а не молча
  // выглядит как «никого нет».
  const filteredFriends = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return friends;
    return friends.filter(
      (friend) =>
        friend.name.toLowerCase().includes(trimmed) || friend.city.toLowerCase().includes(trimmed),
    );
  }, [friends, query]);
  const isSearching = query.trim().length > 0;

  return (
    <SectionContainer>
      <PageHead
        title="Ваши люди"
        description="Все, с кем вы уже знакомы в зале — пишите без повода, дружба для этого не нужна."
      />

      <div className={styles['friends__tabs']} role="tablist" aria-label="Раздел «Друзья»">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'friends'}
          className={cn(
            styles['friends__tab'],
            tab === 'friends' && styles['friends__tab--active'],
          )}
          onClick={() => setTab('friends')}
        >
          Все друзья
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'requests'}
          className={cn(
            styles['friends__tab'],
            tab === 'requests' && styles['friends__tab--active'],
          )}
          onClick={() => setTab('requests')}
        >
          Заявки
          {requestsCount > 0 && <Badge variant="soft">{requestsCount}</Badge>}
        </button>
      </div>

      {tab === 'friends' ? (
        <>
          {/* Только когда реально есть, что искать — иначе на пустом списке
              (см. `EmptyState` ниже) висел бы рабочий на вид инпут без
              всякого смысла. */}
          {status === 'success' && friends.length > 0 && (
            <label className={styles['friends__search']}>
              <SearchIcon className={styles['friends__search-icon']} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти среди друзей — по имени или городу"
              />
            </label>
          )}

          {status === 'loading' && (
            <div className={styles['friends__grid']}>
              {Array.from({ length: FRIENDS_SKELETON_COUNT }, (_, index) => (
                <FriendCardSkeleton key={index} />
              ))}
            </div>
          )}
          {status === 'error' && <ErrorState message={error} onRetry={loadFriends} />}

          {status === 'success' && friends.length === 0 && (
            <EmptyState
              title="У вас пока нет друзей"
              description="Как только кто-то станет вашим другом, вы увидите его здесь. А пока можно просто написать кому-нибудь — для этого дружба не нужна."
            />
          )}

          {status === 'success' &&
            friends.length > 0 &&
            isSearching &&
            filteredFriends.length === 0 && (
              <EmptyState
                title="Никого не нашли"
                description={
                  nextCursor
                    ? 'Попробуйте другое имя или город — либо прокрутите список ниже, чтобы подгрузить ещё друзей.'
                    : 'Попробуйте другое имя или город.'
                }
              />
            )}

          {status === 'success' && filteredFriends.length > 0 && (
            <>
              <div className={styles['friends__grid']}>
                {filteredFriends.map((friend) => (
                  <FriendCard
                    key={friend.id}
                    friend={friend}
                    onMessage={() => onMessage(friend)}
                    onAuthorClick={goToUserProfile}
                    onRemove={() => void removeFriend(friend.id)}
                  />
                ))}
                {loadMoreStatus === 'loading' &&
                  Array.from({ length: 3 }, (_, index) => <FriendCardSkeleton key={index} />)}
              </div>
              <div ref={sentinelRef} aria-hidden="true" />
            </>
          )}
        </>
      ) : (
        <div className={styles['friends__requests']}>
          {(requestsStatus === 'loading' || followRequestsStatus === 'loading') &&
            requestsCount === 0 && <Loader label="Загружаем заявки…" />}
          {requestsStatus === 'error' && (
            <ErrorState message={requestsError} onRetry={loadRequests} />
          )}
          {followRequestsStatus === 'error' && (
            <ErrorState message={followRequestsError} onRetry={loadFollowRequests} />
          )}

          {requestsStatus === 'success' &&
            followRequestsStatus === 'success' &&
            requestsCount === 0 && (
              <EmptyState
                title="Заявок пока нет"
                description="Здесь появятся те, кто хочет добавить вас в друзья или подписаться на вашу страницу, и те, кому заявку отправили вы."
              />
            )}

          {incoming.length > 0 && (
            <section className={styles['friends__requests-group']}>
              <h2 className={styles['friends__requests-group-title']}>
                Входящие · {incoming.length}
              </h2>
              <div className={styles['friends__requests-list']}>
                {incoming.map((request) => (
                  <FriendRequestCard
                    key={request.id}
                    request={request}
                    variant="incoming"
                    onAccept={() => void acceptRequest(request.id)}
                    onRemove={() => void removeRequest(request.id)}
                    onAuthorClick={goToUserProfile}
                  />
                ))}
              </div>
            </section>
          )}

          {outgoing.length > 0 && (
            <section className={styles['friends__requests-group']}>
              <h2 className={styles['friends__requests-group-title']}>
                Исходящие · {outgoing.length}
              </h2>
              <div className={styles['friends__requests-list']}>
                {outgoing.map((request) => (
                  <FriendRequestCard
                    key={request.id}
                    request={request}
                    variant="outgoing"
                    onRemove={() => void removeRequest(request.id)}
                    onAuthorClick={goToUserProfile}
                  />
                ))}
              </div>
            </section>
          )}

          {followIncoming.length > 0 && (
            <section className={styles['friends__requests-group']}>
              <h2 className={styles['friends__requests-group-title']}>
                Заявки на подписку · Входящие · {followIncoming.length}
              </h2>
              <div className={styles['friends__requests-list']}>
                {followIncoming.map((request) => (
                  <SubscriptionRequestCard
                    key={request.id}
                    request={request}
                    variant="incoming"
                    onAccept={() => void acceptFollowRequest(request.id)}
                    onRemove={() => void removeFollowRequest(request.id)}
                    onAuthorClick={goToUserProfile}
                  />
                ))}
              </div>
            </section>
          )}

          {followOutgoing.length > 0 && (
            <section className={styles['friends__requests-group']}>
              <h2 className={styles['friends__requests-group-title']}>
                Заявки на подписку · Исходящие · {followOutgoing.length}
              </h2>
              <div className={styles['friends__requests-list']}>
                {followOutgoing.map((request) => (
                  <SubscriptionRequestCard
                    key={request.id}
                    request={request}
                    variant="outgoing"
                    onRemove={() => void removeFollowRequest(request.id)}
                    onAuthorClick={goToUserProfile}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </SectionContainer>
  );
}
