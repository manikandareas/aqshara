import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VIDEO_INTERNAL_TOKEN_HEADER } from './video-jobs.constants';

@Injectable()
export class VideoJobsInternalAuthService {
  private readonly internalToken: string;

  constructor(private readonly configService: ConfigService) {
    this.internalToken = this.configService.get<string>(
      'VIDEO_INTERNAL_SERVICE_TOKEN',
      'local-video-internal-token',
    );
  }

  assertValid(headerValue: string | string[] | undefined): void {
    const token = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!token || token !== this.internalToken) {
      throw new ForbiddenException(`${VIDEO_INTERNAL_TOKEN_HEADER} is invalid`);
    }
  }
}
