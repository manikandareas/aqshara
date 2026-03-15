import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      isHttpException && typeof exception.getResponse() === 'object'
        ? (exception.getResponse() as { message?: string | string[] }).message
        : ((exception as Error | undefined)?.message ??
          'Internal server error');

    response.status(status).json({
      error: {
        code: this.getErrorCode(status),
        message,
        status,
        request_id: request.id ?? 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  }

  private getErrorCode(status: number): string {
    if (status >= 500) {
      return 'INTERNAL_ERROR';
    }

    switch (status) {
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 400:
        return 'BAD_REQUEST';
      default:
        return 'REQUEST_ERROR';
    }
  }
}
