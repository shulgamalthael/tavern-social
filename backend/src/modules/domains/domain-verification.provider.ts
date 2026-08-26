/**
 * Абстракция над проверкой владения доменом (см. корневой план задачи,
 * разделы «MVP verification»/«Infrastructure abstraction») — `DomainsService`
 * зависит только от этого класса, не от конкретного способа проверки.
 * Сегодня единственная реализация — `DnsTxtDomainVerificationProvider`
 * (обычный DNS TXT-lookup, см. рядом), но позже можно подставить
 * `VercelDomainVerificationProvider`/`CloudflareDomainVerificationProvider`
 * через провайдер в `DomainsModule`, не трогая ни `DomainsService`, ни
 * контроллер, ни схему БД.
 *
 * Абстрактный класс, а не `interface` — у NestJS DI нет рантайм-токенов для
 * чистых TS-интерфейсов (они стираются при компиляции), а абстрактный класс
 * можно использовать как токен провайдера напрямую (`useClass`/`useValue` в
 * `DomainsModule`) без отдельной строки-токена.
 */
export abstract class DomainVerificationProvider {
  /** `true`, если запись действительно найдена и совпадает с токеном —
   * `false` для любого «пока не готово» (домен не резолвится, TTL DNS ещё
   * не обновился, неправильное значение) и для настоящих ошибок сети
   * одинаково: MVP не различает эти случаи для пользователя (см. корневой
   * план, `DomainDto.status`), только предлагает попробовать снова. */
  abstract verify(hostname: string, verificationToken: string): Promise<boolean>;
}
