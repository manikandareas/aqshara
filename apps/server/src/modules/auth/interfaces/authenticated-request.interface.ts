import type { Request } from 'express';
import type { AuthContext } from './auth-context.interface';

export type AuthenticatedRequest = Request & {
  auth?: AuthContext;
  rawBody?: Buffer;
};
