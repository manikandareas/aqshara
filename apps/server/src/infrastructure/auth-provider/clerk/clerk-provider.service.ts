import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient, type ClerkClient } from '@clerk/backend';
import type { Request as ExpressRequest } from 'express';

export type ClerkAuthPayload = {
  userId: string;
  sessionId: string | null;
  orgId: string | null;
};

@Injectable()
export class ClerkProviderService {
  private readonly clerkClient: ClerkClient;

  constructor(private readonly configService: ConfigService) {
    this.clerkClient = createClerkClient({
      secretKey: this.configService.getOrThrow<string>('CLERK_SECRET_KEY'),
      publishableKey: this.configService.getOrThrow<string>(
        'CLERK_PUBLISHABLE_KEY',
      ),
      jwtKey: this.configService.get<string>('CLERK_JWT_KEY'),
    });
  }

  async authenticateRequest(
    request: ExpressRequest,
  ): Promise<ClerkAuthPayload> {
    const requestState = await this.clerkClient.authenticateRequest(
      this.toFetchRequest(request),
      {
        acceptsToken: 'session_token',
        authorizedParties: this.getAuthorizedParties(),
      },
    );

    if (!requestState.isAuthenticated) {
      throw new UnauthorizedException(requestState.message || 'Unauthorized');
    }

    const auth = requestState.toAuth();
    if (!auth.userId) {
      throw new UnauthorizedException('Missing Clerk user in token');
    }

    return {
      userId: auth.userId,
      sessionId: auth.sessionId ?? null,
      orgId: auth.orgId ?? null,
    };
  }

  private getAuthorizedParties(): string[] | undefined {
    const rawAuthorizedParties = this.configService.get<string>(
      'CLERK_AUTHORIZED_PARTIES',
    );

    if (!rawAuthorizedParties) {
      return undefined;
    }

    const values = rawAuthorizedParties
      .split(',')
      .map((party) => party.trim())
      .filter((party) => party.length > 0);

    return values.length > 0 ? values : undefined;
  }

  private toFetchRequest(request: ExpressRequest): globalThis.Request {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) {
        headers.set(name, value.join(','));
      } else if (typeof value === 'string') {
        headers.set(name, value);
      }
    }

    return new Request(this.resolveRequestUrl(request), {
      method: request.method,
      headers,
    });
  }

  private resolveRequestUrl(request: ExpressRequest): string {
    if (request.protocol && request.get('host')) {
      return `${request.protocol}://${request.get('host')}${request.originalUrl}`;
    }

    return `http://localhost${request.originalUrl}`;
  }
}
