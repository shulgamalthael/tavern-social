import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { OAuthProviderRegistry } from '../providers/oauth-provider-registry.service';

/**
 * Проверяет `:provider` из `GET /auth/:provider`/`/auth/:provider/callback`
 * (`AuthController`) — неизвестное имя провайдера (например, `apple`, для
 * которого адаптера ещё нет) отклоняется 400, известный, но не настроенный
 * в `.env` (нет `GOOGLE_CLIENT_ID`/`FACEBOOK_CLIENT_ID` и т. п.) — 503, тот
 * же приём, что `AiConfiguredGuard` для Gemini.
 */
@Injectable()
export class OAuthConfiguredGuard implements CanActivate {
  constructor(private readonly registry: OAuthProviderRegistry) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    // Express типизирует `params[key]` как `string | string[]` (wildcard-
    // сегменты вида `*`) — у именованного `:provider` в реальности всегда
    // строка, но сужаем явно, а не приведением типа.
    const rawProvider = request.params.provider;
    const provider = typeof rawProvider === 'string' ? rawProvider : '';

    if (!this.registry.isKnownProvider(provider)) {
      throw new BadRequestException(`Неизвестный провайдер входа: "${provider}"`);
    }
    if (!this.registry.get(provider).isConfigured()) {
      throw new ServiceUnavailableException(
        `Вход через ${provider} ещё не настроен на этом сервере`,
      );
    }
    return true;
  }
}
