import { ApiResponse } from '@nestjs/swagger';

export const GlobalErrorSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', example: 'VALIDATION_ERROR' },
    message: { type: 'string', example: 'Invalid input data' },
    details: { type: 'object', additionalProperties: true, example: { field: 'Required' } },
    timestamp: { type: 'string', format: 'date-time', example: '2026-09-28T10:00:00Z' },
    path: { type: 'string', example: '/api/v1/resource' }
  }
};

export function ApiErrorResponse(status: number, description: string, exampleCode?: string, exampleMessage?: string) {
  return ApiResponse({
    status,
    description,
    schema: {
      ...GlobalErrorSchema,
      example: {
        code: exampleCode || 'ERROR_CODE',
        message: exampleMessage || 'Error message',
        details: {},
        timestamp: new Date().toISOString(),
        path: '/api/v1/resource'
      }
    }
  });
}
