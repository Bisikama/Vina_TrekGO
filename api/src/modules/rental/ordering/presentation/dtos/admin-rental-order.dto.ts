import { z } from 'zod';
import { RentalFinancialStatus, RentalOrderExceptionStatus, RentalOrderStatus } from '@prisma/client';
import { SYSTEM_FAULT_REASON_CODES } from '../../application/ports/rental-system-fault-cancellation.port';

export const ListAdminRentalOrdersQuerySchema = z.object({
  tripId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: z.nativeEnum(RentalOrderStatus).optional(),
  financialStatus: z.nativeEnum(RentalFinancialStatus).optional(),
  exceptionStatus: z.nativeEnum(RentalOrderExceptionStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListAdminRentalOrdersQueryDto = z.infer<typeof ListAdminRentalOrdersQuerySchema>;

export const AdminRentalOrderIdParamSchema = z.object({
  orderId: z.string().uuid(),
});

export type AdminRentalOrderIdParamDto = z.infer<typeof AdminRentalOrderIdParamSchema>;

export const SystemFaultCancellationBodySchema = z
  .object({
    reasonCode: z.enum(SYSTEM_FAULT_REASON_CODES),
    note: z.string().trim().min(3).max(2000),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export type SystemFaultCancellationBodyDto = z.infer<typeof SystemFaultCancellationBodySchema>;

export const AdminIdempotencyKeySchema = z.string().trim().min(8).max(200);

