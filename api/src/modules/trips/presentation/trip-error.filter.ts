import { ArgumentsHost, Catch, HttpException } from '@nestjs/common'
import type { ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'

@Catch(HttpException)
export class TripErrorFilter implements ExceptionFilter {
  catch(error: HttpException, host: ArgumentsHost) {
    const statusCode = error.getStatus()
    const result = error.getResponse()
    const payload = typeof result === 'string' ? { message: result } : result
    const codes: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHENTICATED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'INVALID_STATE_TRANSITION',
      422: 'TRIP_NOT_READY_TO_PUBLISH',
    }
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(statusCode)
      .json({ statusCode, code: codes[statusCode] || 'REQUEST_FAILED', ...payload })
  }
}
