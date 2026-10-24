import { ApiResponse } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'

export const GlobalErrorSchema: SchemaObject = {
  type: 'object',
  required: ['error', 'meta'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message', 'retryable'],
      properties: {
        code: { type: 'string', example: 'VALIDATION_ERROR' },
        message: { type: 'string', example: 'Dữ liệu đầu vào không hợp lệ' },
        details: {
          nullable: true,
          oneOf: [
            { type: 'object', additionalProperties: true },
            {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'paymentMethod' },
                  message: { type: 'string', example: 'Invalid option' },
                },
              },
            },
          ],
        },
        retryable: { type: 'boolean', example: false },
      },
    },
    meta: {
      type: 'object',
      required: ['requestId', 'serverTime', 'contractVersion'],
      properties: {
        requestId: { type: 'string', example: 'a2f7482f-a30d-4554-af39-58df51f7ac18' },
        serverTime: { type: 'string', format: 'date-time', example: '2026-10-18T09:00:00.000Z' },
        contractVersion: { type: 'string', example: '0.2.0-final-flow' },
      },
    },
  },
}

export function ApiErrorResponse(status: number, description: string, exampleCode?: string, exampleMessage?: string) {
  return ApiResponse({
    status,
    description,
    schema: {
      ...GlobalErrorSchema,
      example: {
        error: {
          code: exampleCode || 'ERROR_CODE',
          message: exampleMessage || 'Error message',
          details: undefined,
          retryable: status >= 500,
        },
        meta: {
          requestId: 'a2f7482f-a30d-4554-af39-58df51f7ac18',
          serverTime: '2026-10-18T09:00:00.000Z',
          contractVersion: '0.2.0-final-flow',
        },
      },
    },
  })
}

export function ApiErrorResponses(
  status: number,
  description: string,
  examples: Array<{ name: string; summary: string; code: string; message: string; retryable?: boolean }>,
) {
  return ApiResponse({
    status,
    description,
    content: {
      'application/json': {
        schema: GlobalErrorSchema,
        examples: Object.fromEntries(
          examples.map((example) => [
            example.name,
            {
              summary: example.summary,
              value: {
                error: {
                  code: example.code,
                  message: example.message,
                  retryable: example.retryable ?? status >= 500,
                },
                meta: {
                  requestId: 'a2f7482f-a30d-4554-af39-58df51f7ac18',
                  serverTime: '2026-10-18T09:00:00.000Z',
                  contractVersion: '0.2.0-final-flow',
                },
              },
            },
          ]),
        ),
      },
    },
  })
}
