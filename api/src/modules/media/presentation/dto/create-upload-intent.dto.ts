import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { MediaScopeValue, MediaResourceTypeValue, MediaCaptureSourceValue } from '../../application/ports/media-asset.port';

export const createUploadIntentSchema = z.object({
  scope: z.enum(['RENTAL_PRODUCT', 'CONDITION_EVIDENCE', 'RETURN_EVIDENCE', 'EXCEPTION_EVIDENCE', 'LEADER_CERTIFICATE'] as const),
  resourceType: z.enum(['IMAGE', 'VIDEO'] as const),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  captureSource: z.enum(['CAMERA', 'GALLERY', 'FILE', 'SYSTEM', 'UNKNOWN'] as const).default('UNKNOWN'),
  clientCapturedAt: z.string().datetime({ offset: true }).optional(),
}).strict();

export class CreateUploadIntentDto {
  @ApiProperty({ example: 'RENTAL_PRODUCT', enum: ['RENTAL_PRODUCT', 'CONDITION_EVIDENCE', 'RETURN_EVIDENCE', 'EXCEPTION_EVIDENCE', 'LEADER_CERTIFICATE'] })
  scope!: MediaScopeValue;

  @ApiProperty({ example: 'IMAGE', enum: ['IMAGE', 'VIDEO'] })
  resourceType!: MediaResourceTypeValue;

  @ApiProperty({ example: 'photo.jpg' })
  fileName!: string;

  @ApiProperty({ example: 'image/jpeg' })
  contentType!: string;

  @ApiProperty({ example: 102400 })
  sizeBytes!: number;

  @ApiPropertyOptional({ example: 'CAMERA', enum: ['CAMERA', 'GALLERY', 'FILE', 'SYSTEM', 'UNKNOWN'], default: 'UNKNOWN' })
  captureSource?: MediaCaptureSourceValue;

  @ApiPropertyOptional({ example: '2023-10-01T12:00:00Z' })
  clientCapturedAt?: string;
}
