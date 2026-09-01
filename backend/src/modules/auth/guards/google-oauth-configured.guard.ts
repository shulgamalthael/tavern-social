import {
  Injectable,
  ServiceUnavailableException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { GoogleOAuthAdapter } from '../providers/google-oauth-adapter.service';

/**
 * Проверяет, что вход через Google вообще настроен (`GOOGLE_CLIENT_ID`/
 * `_SECRET` в `.env`) — применяется к `GET /auth/google`/`/auth/google/
 * callback`, тот же приём, что `AiConfiguredGuard` для Gemini.
 */
@Injectable()
export class GoogleOAuthConfiguredGuard implements CanActivate {
  constructor(private readonly googleOAuthAdapter: GoogleOAuthAdapter) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.googleOAuthAdapter.isConfigured()) {
      throw new ServiceUnavailableException('Вход через Google ещё не настроен на этом сервере');
    }
    return true;
  }
}
