import { Module } from '@nestjs/common';
import { UsersModule } from '@/modules/users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleOAuthConfiguredGuard } from './guards/google-oauth-configured.guard';
import { GoogleOAuthAdapter } from './providers/google-oauth-adapter.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, GoogleOAuthAdapter, GoogleOAuthConfiguredGuard],
})
export class AuthModule {}
