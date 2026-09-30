import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { AppError } from './app-error';
import { ERROR_DEFINITIONS } from './error-definitions';
import { COMMON_ERROR_CODES } from './codes/common.error-codes';
import { randomUUID } from 'crypto';

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<any>();
    
    let code: string = COMMON_ERROR_CODES.INTERNAL_ERROR;
    let message: string = 'Internal server error';
    let status: number = 500;
    let details: Record<string, unknown> | undefined = undefined;
    let retryable: boolean = false;

    if (exception instanceof AppError) {
      code = exception.code;
      const def = ERROR_DEFINITIONS[code];
      status = def?.status || 500;
      message = exception.message && exception.message !== exception.code 
        ? exception.message 
        : (def?.message || message);
      details = exception.details;
      retryable = exception.retryable ?? (def?.retryable || false);
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      
      // Map common HTTP exceptions to AppError codes
      if (status === 400) code = COMMON_ERROR_CODES.VALIDATION_ERROR;
      else if (status === 401) code = COMMON_ERROR_CODES.UNAUTHENTICATED;
      else if (status === 403) code = COMMON_ERROR_CODES.FORBIDDEN;
      
      message = typeof res === 'string' ? res : (res as any).message || exception.message;
      details = typeof res === 'object' ? (res as any).errors || (res as any).details : undefined;
    } else {
      console.error('Unhandled Exception:', exception);
    }

    response.status(status).json({
      error: {
        code,
        message,
        details,
        retryable,
      },
      meta: {
        requestId: request.id || request.headers['x-request-id'] || randomUUID(),
        serverTime: new Date().toISOString(),
        contractVersion: '0.2.0-final-flow',
      },
    });
  }
}
