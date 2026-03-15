import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { ClerkAuthService } from '../clerk-auth.service';
import { ClerkAuthGuard } from '../guards/clerk-auth.guard';

describe('ClerkAuthGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const configService = {
    get: jest.fn().mockReturnValue('api/v1'),
  } as unknown as ConfigService;

  const authenticateMock = jest.fn();
  const clerkAuthService = {
    authenticate: authenticateMock,
  } as unknown as ClerkAuthService;

  const guard = new ClerkAuthGuard(reflector, configService, clerkAuthService);

  const createContext = (
    request: Record<string, unknown>,
  ): ExecutionContext => {
    return {
      getType: () => 'http',
      getHandler: () => ({}),
      getClass: () => class TestClass {},
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bypasses public routes', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

    const result = await guard.canActivate(
      createContext({ method: 'GET', path: '/api/v1/healthz' }),
    );

    expect(result).toBe(true);
    expect(authenticateMock).not.toHaveBeenCalled();
  });

  it('bypasses webhook route', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

    const result = await guard.canActivate(
      createContext({ method: 'POST', path: '/api/v1/webhooks/polar' }),
    );

    expect(result).toBe(true);
    expect(authenticateMock).not.toHaveBeenCalled();
  });

  it('bypasses options preflight requests', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

    const result = await guard.canActivate(
      createContext({ method: 'OPTIONS', path: '/api/v1/documents' }),
    );

    expect(result).toBe(true);
    expect(authenticateMock).not.toHaveBeenCalled();
  });

  it('attaches auth context for protected routes', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    authenticateMock.mockResolvedValue({
      userId: 'user_123',
      sessionId: 'sess_123',
      orgId: null,
    });

    const request: Record<string, unknown> = {
      method: 'GET',
      path: '/api/v1/documents',
    };

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(request.auth).toEqual({
      userId: 'user_123',
      sessionId: 'sess_123',
      orgId: null,
    });
  });

  it('maps access_token query to authorization header for SSE status stream', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    authenticateMock.mockResolvedValue({
      userId: 'user_stream',
      sessionId: null,
      orgId: null,
    });

    const request: Record<string, unknown> = {
      method: 'GET',
      path: '/api/v1/documents/doc_123/status/stream',
      headers: {},
      query: {
        access_token: 'stream_token',
      },
    };

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect((request.headers as Record<string, string>).authorization).toBe(
      'Bearer stream_token',
    );
    expect(authenticateMock).toHaveBeenCalledTimes(1);
  });

  it('propagates unauthorized errors for protected routes', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    authenticateMock.mockRejectedValue(
      new UnauthorizedException('Invalid token'),
    );

    await expect(
      guard.canActivate(
        createContext({ method: 'GET', path: '/api/v1/documents' }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
