import type { Request } from 'express';

export interface RequestUser {
  id: string;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}
