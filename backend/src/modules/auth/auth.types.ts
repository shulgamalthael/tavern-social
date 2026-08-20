import type { MeProfile } from '@/modules/users/users.types';

export interface AuthSession {
  token: string;
  user: MeProfile;
}
