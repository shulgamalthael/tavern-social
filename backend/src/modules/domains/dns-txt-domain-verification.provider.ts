import { Injectable, Logger } from '@nestjs/common';
import { promises as dns } from 'node:dns';
import { DomainVerificationProvider } from './domain-verification.provider';

/**
 * Реальная (не заглушка), но простая проверка владения доменом — ищет TXT-
 * запись `_tavern-verify.<hostname>` со значением `verificationToken` (см.
 * `DomainsService.buildDnsInstructions` — тот же префикс в инструкции
 * пользователю). Тот же принцип, что у большинства SaaS с custom domains
 * (Vercel/Netlify и т. п.): TXT-запись доказывает контроль над DNS домена,
 * не требуя собственного ACME/сертификатов (см. корневой план задачи,
 * раздел «Не реализовывать собственный DNS»).
 */
@Injectable()
export class DnsTxtDomainVerificationProvider extends DomainVerificationProvider {
  private readonly logger = new Logger(DnsTxtDomainVerificationProvider.name);

  async verify(hostname: string, verificationToken: string): Promise<boolean> {
    try {
      const records = await dns.resolveTxt(`_tavern-verify.${hostname}`);
      return records.some((chunks) => chunks.join('').trim() === verificationToken);
    } catch (error) {
      // NXDOMAIN/ENODATA/таймаут — не ошибка приложения, а «DNS ещё не
      // готов» (обычное дело сразу после того, как пользователь поменял
      // запись — TTL кэшируется резолверами). Логируем на debug-уровне,
      // чтобы не шуметь в проде на каждую честную попытку до готовности DNS.
      this.logger.debug(`Верификация ${hostname} не прошла: ${(error as Error).message}`);
      return false;
    }
  }
}
