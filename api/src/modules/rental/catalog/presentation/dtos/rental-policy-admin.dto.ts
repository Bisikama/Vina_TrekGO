import { z } from 'zod';

const optionalMinutes = z.number().int().min(0).max(525_600).nullable();

/** RB-API-704: thay cả cấu hình để mỗi version là một snapshot đầy đủ. */
export const RentalPolicyValuesSchema = z.strictObject({
  currency: z.literal('VND'),
  dayCountMode: z.literal('CEIL_24H'),
  quoteTtlMinutes: z.literal(10),
  paymentHoldMinutes: z.literal(15),
  freeCancellationHours: z.literal(24),
  cutoffHoursBeforeTrip: z.literal(24),
  prepBufferMinutes: z.literal(720),
  returnBufferMinutes: z.literal(1440),
  cleaningBufferMinutes: z.number().int().min(0).max(1440),
  deepInspectionBufferMinutes: z.literal(2880),
  pickupCodeTtlMinutes: z.literal(15),
  pickupVerificationTtlMinutes: z.literal(10),
  overdueReviewMinutes: z.literal(120),
  deepInspectionReviewMinutes: z.literal(2880),
  adminApprovalMinutes: z.literal(1440),
  userAssessmentReviewMinutes: z.literal(2880),
  lostConfirmationMinutes: optionalMinutes.refine((minutes) => minutes === null || minutes >= 2880,
    'LOST confirmation requires at least 48 hours'),
  maxRentalAfterTripHours: z.literal(48),
  extensionRequestCutoffMinutes: z.literal(120),
  extensionHoldMinutes: z.literal(15),
  maxExtensionCount: z.literal(2),
  maxTotalRentalDays: z.literal(14),
  returnInspectionSlaHours: z.literal(72),
  deepInspectionSlaHours: z.literal(24),
  returnToInventoryAllowanceHours: z.literal(8),
  postInspectionCleaningAllowanceHours: z.literal(8),
  cancellationRules: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())])
    .refine((value) => JSON.stringify(value).length <= 8192, 'Cancellation rules too large'),
});

export const PublishRentalPolicySchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(10).max(500),
  policy: RentalPolicyValuesSchema,
});

export type PublishRentalPolicyDto = z.infer<typeof PublishRentalPolicySchema>;
