import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ClerkProviderModule } from '../../infrastructure/auth-provider/clerk/clerk-provider.module';
import { ClerkAuthService } from './clerk-auth.service';
import { ClerkAuthGuard } from './guards/clerk-auth.guard';

@Module({
  imports: [ClerkProviderModule],
  providers: [
    ClerkAuthService,
    {
      provide: APP_GUARD,
      useClass: ClerkAuthGuard,
    },
  ],
  exports: [ClerkAuthService],
})
export class AuthModule {}
