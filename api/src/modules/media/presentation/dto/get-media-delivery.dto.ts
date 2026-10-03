import { z } from 'zod';

export const getMediaDeliverySchema = z.object({
  variant: z.enum([
    'CATALOG_THUMBNAIL',
    'CATALOG_CARD',
    'CATALOG_DETAIL',
    'EVIDENCE_THUMBNAIL',
    'EVIDENCE_PREVIEW',
    'VIDEO_PREVIEW'
  ]),
  format: z.enum(['AUTO', 'WEBP', 'JPEG']).optional(),
});

export type GetMediaDeliveryDto = z.infer<typeof getMediaDeliverySchema>;
