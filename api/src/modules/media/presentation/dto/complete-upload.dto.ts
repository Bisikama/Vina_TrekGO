import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const completeUploadSchema = z.object({
  publicId: z.string().min(1),
  version: z.number().int().positive(),
  signature: z.string().min(1),
}).strict();

export class CompleteUploadDto {
  @ApiProperty({ example: 'trekgo/test/123' })
  publicId!: string;

  @ApiProperty({ example: 123456789 })
  version!: number;

  @ApiProperty({ example: 'abcdef1234567890' })
  signature!: string;
}
