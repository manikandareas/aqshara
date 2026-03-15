import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_ROUTE } from '../auth.constants';
import { ClerkAuthService } from '../clerk-auth.service';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly webhookPath: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly clerkAuthService: ClerkAuthService,
  ) {
    const prefix = this.configService.get<string>('API_PREFIX', 'api/v1');
    const normalizedPrefix = prefix.replace(/^\/+|\/+$/g, '');

    this.webhookPath = `/${normalizedPrefix}/webhooks/polar`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.method === 'OPTIONS' || this.isWebhookRoute(request)) {
      return true;
    }

    this.attachSseAccessToken(request);
    request.auth = await this.clerkAuthService.authenticate(request);
    return true;
  }

  private isWebhookRoute(request: AuthenticatedRequest): boolean {
    const routePath = (request.path || request.originalUrl || request.url || '')
      .split('?')[0]
      .replace(/\/+$/g, '');

    return routePath === this.webhookPath;
  }

  private attachSseAccessToken(request: AuthenticatedRequest): void {
    const routePath = (request.path || request.originalUrl || request.url || '')
      .split('?')[0]
      .replace(/\/+$/g, '');

    if (!routePath.endsWith('/status/stream')) {
      return;
    }

    if (typeof request.headers.authorization === 'string') {
      return;
    }

    const tokenParam = request.query?.access_token;
    let accessToken: string | undefined;

    if (typeof tokenParam === 'string') {
      accessToken = tokenParam;
    } else if (Array.isArray(tokenParam)) {
      accessToken = tokenParam.find(
        (value): value is string => typeof value === 'string',
      );
    }

    if (!accessToken) {
      return;
    }

    request.headers.authorization = `Bearer ${accessToken}`;
  }
}
