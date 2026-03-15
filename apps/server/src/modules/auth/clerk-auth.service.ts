import { Injectable } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { ClerkProviderService } from '../../infrastructure/auth-provider/clerk/clerk-provider.service';
import type { AuthContext } from './interfaces/auth-context.interface';

@Injectable()
export class ClerkAuthService {
  constructor(private readonly clerkProviderService: ClerkProviderService) {}

  async authenticate(request: ExpressRequest): Promise<AuthContext> {
    return this.clerkProviderService.authenticateRequest(request);
  }
}
