import { PipeTransform, ArgumentMetadata, BadRequestException, Injectable } from '@nestjs/common'
import type { ZodSchema } from 'zod'


/**
 * ZodValidationPipe
 * Pipe chuyển đổi và xác thực dữ liệu đầu vào sử dụng Zod Schema
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (!this.schema) {
      return value
    }

    const result = this.schema.safeParse(value)

    if (!result.success) {
      const formattedErrors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'root',
        message: issue.message,
      }))

      throw new BadRequestException({
        statusCode: 400,
        message: 'Dữ liệu đầu vào không hợp lệ',
        errors: formattedErrors,
      })
    }

    return result.data
  }
}
