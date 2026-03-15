import {
  UnauthorizedException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthContext } from '../interfaces/auth-context.interface';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.auth) {
      throw new UnauthorizedException('Missing authenticated context');
    }

    return request.auth;
  },
);
