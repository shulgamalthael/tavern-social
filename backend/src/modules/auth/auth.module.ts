import { Module } from '@nestjs/common';
import { FriendsModule } from '@/modules/friends/friends.module';
import { SubscriptionsModule } from '@/modules/subscriptions/subscriptions.module';
import { UsersModule } from '@/modules/users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleOAuthConfiguredGuard } from './guards/google-oauth-configured.guard';
import { GoogleOAuthAdapter } from './providers/google-oauth-adapter.service';

@Module({
  imports: [UsersModule, SubscriptionsModule, FriendsModule],
  controllers: [AuthController],
  providers: [AuthService, GoogleOAuthAdapter, GoogleOAuthConfiguredGuard],
})
export class AuthModule {}
