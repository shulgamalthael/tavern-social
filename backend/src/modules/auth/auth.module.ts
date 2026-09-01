import { Module } from '@nestjs/common';
import { UsersModule } from '@/modules/users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthConfiguredGuard } from './guards/oauth-configured.guard';
import { FacebookOAuthAdapter } from './providers/facebook-oauth-adapter.service';
import { GoogleOAuthAdapter } from './providers/google-oauth-adapter.service';
import { OAuthProviderRegistry } from './providers/oauth-provider-registry.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleOAuthAdapter,
    FacebookOAuthAdapter,
    OAuthProviderRegistry,
    OAuthConfiguredGuard,
  ],
})
export class AuthModule {}
