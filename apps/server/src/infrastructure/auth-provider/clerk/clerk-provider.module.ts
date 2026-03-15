import { Module } from '@nestjs/common';
import { ClerkProviderService } from './clerk-provider.service';

@Module({
  providers: [ClerkProviderService],
  exports: [ClerkProviderService],
})
export class ClerkProviderModule {}
