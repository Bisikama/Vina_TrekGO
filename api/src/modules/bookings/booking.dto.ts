import { z } from 'zod'

export const bookingIdSchema = z.string().uuid()
export const bookingKeySchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\x21-\x7e]+$/)
export const participantSchema = z
  .object({
    id: z.string().uuid().optional(),
    fullName: z.string().trim().min(1).max(150),
    phone: z.string().trim().min(5).max(30).optional(),
    dateOfBirth: z.iso
      .date()
      .refine((v) => v <= new Date().toISOString().slice(0, 10), 'Birth date cannot be in the future')
      .optional(),
    emergencyContactName: z.string().trim().min(1).max(150).optional(),
    emergencyContactPhone: z.string().trim().min(5).max(30).optional(),
  })
  .strict()
const participantInput = z
  .object({
    participantCount: z.number().int().min(1).max(100),
    participants: z.array(participantSchema).min(1).max(100),
  })
  .strict()
const consistent = (v: { participantCount: number; participants: { id?: string }[] }) =>
  v.participantCount === v.participants.length &&
  new Set(v.participants.flatMap((p) => (p.id ? [p.id] : []))).size === v.participants.filter((p) => p.id).length
export const createBookingSchema = participantInput
  .refine(consistent, 'Participant count/data must match')
  .refine((v) => v.participants.every((p) => !p.id), 'New participants cannot supply IDs')
export const updateParticipantsSchema = participantInput
  .extend({ expectedVersion: z.number().int().positive() })
  .refine(consistent, 'Participant count/data must match')
export const bookingPageSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(12),
    status: z
      .enum([
        'PENDING_PAYMENT',
        'CONFIRMED',
        'EXPIRED',
        'CANCELLED',
        'CHECKED_IN',
        'PARTIAL_CHECKIN',
        'COMPLETED',
        'NO_SHOW',
      ])
      .optional(),
  })
  .strict()
export const tripSearchSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(12),
    destinationId: z.string().uuid().optional(),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'EXTREME']).optional(),
    price: z.coerce.number().int().nonnegative().optional(),
  })
  .strict()
  .refine((v) => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo, 'Invalid date range')
export type CreateBookingInput = z.infer<typeof createBookingSchema>
export type UpdateParticipantsInput = z.infer<typeof updateParticipantsSchema>
export type BookingPage = z.infer<typeof bookingPageSchema>
export type TripSearch = z.infer<typeof tripSearchSchema>
