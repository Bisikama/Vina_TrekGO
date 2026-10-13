import { ApiResponse } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { z } from 'zod'

const uuid = z.uuid()
const timestamp = z.iso.datetime().nullable()
const applicationStatus = z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'])
const applicant = z.object({ id: uuid, fullName: z.string(), email: z.string() })
const certificate = z.object({
  id: uuid,
  typeCode: z.string(),
  otherTypeName: z.string().nullable(),
  certificateNumber: z.string().nullable(),
  issuer: z.string().nullable(),
  issuedAt: z.iso.date().nullable(),
  expiresAt: z.iso.date().nullable(),
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED']),
  rejectionReason: z.string().nullable(),
  verifiedAt: timestamp,
  mediaId: uuid.nullable(),
})
const application = z.object({
  id: uuid,
  status: applicationStatus,
  motivation: z.string().nullable(),
  experienceSummary: z.string().nullable(),
  submittedAt: timestamp,
  reviewedAt: timestamp,
  rejectionReason: z.string().nullable(),
})
const paged = (item: z.ZodType) =>
  z.object({ items: z.array(item), page: z.number().int(), limit: z.number().int(), total: z.number().int() })
const responses = {
  submit: z.object({
    id: uuid,
    status: z.literal('SUBMITTED'),
    submittedAt: timestamp,
    certificateCount: z.number().int(),
  }),
  mine: paged(application.extend({ certificates: z.array(certificate) })),
  types: z.object({ items: z.array(z.object({ code: z.string(), label: z.string() })) }),
  list: paged(
    z.object({
      id: uuid,
      status: applicationStatus,
      applicant,
      submittedAt: timestamp,
      reviewedAt: timestamp,
      certificateCount: z.number().int(),
    }),
  ),
  detail: application.extend({
    applicant,
    certificates: z.array(certificate.extend({ downloadUrl: z.url(), downloadExpiresAt: z.iso.datetime() })),
  }),
  review: z.object({
    applicationId: uuid,
    status: z.enum(['APPROVED', 'REJECTED']),
    userRole: z.enum(['USER', 'LEADER']),
    reviewedAt: z.iso.datetime(),
  }),
}

export const openApiSchema = (s: z.ZodType) => z.toJSONSchema(s, { target: 'openapi-3.0' }) as SchemaObject
export const LeaderResponse = (name: keyof typeof responses, status: number) =>
  ApiResponse({ status, schema: openApiSchema(responses[name]) })
