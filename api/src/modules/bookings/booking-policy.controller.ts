import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'
import { z } from 'zod'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import { Auth } from '../../shared/decorators/auth.decorator'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { Roles } from '../../shared/decorators/roles.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { BookingPolicyService } from './booking-policy.service'
import { policyContentSchema, policyUpdateSchema, policyRevisionSchema, policyPageSchema } from './booking-policy'
import type { PolicyContent } from './booking-policy'

const bodySchema = (schema: z.ZodType) => {
  const { $schema, ...json } = z.toJSONSchema(schema, { target: 'openapi-3.0' })
  return json as SchemaObject
}

const policyView = z.object({
  id: z.string().uuid(),
  policyCode: z.string(),
  versionNo: z.number().int(),
  revision: z.number().int(),
  holdTtlMinutes: z.number().int(),
  cancellationRules: z.unknown(),
  participantRules: z.unknown().nullable(),
  noShowRules: z.unknown().nullable(),
  isActive: z.boolean(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
})

@Controller('admin/booking-policies')
@ApiTags('Admin booking policies')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles(UserRole.ADMIN)
@ApiResponse({ status: 400, description: 'VALIDATION_ERROR; shared error/meta envelope' })
@ApiResponse({ status: 401, description: 'UNAUTHENTICATED' })
@ApiResponse({ status: 403, description: 'Only ACTIVE ADMIN accounts may access policy CRUD/publish' })
@ApiResponse({ status: 404, description: 'BOOKING_POLICY_NOT_FOUND' })
@ApiResponse({ status: 409, description: 'BOOKING_POLICY_IMMUTABLE / BOOKING_POLICY_VERSION_CONFLICT' })
export class BookingPolicyController {
  constructor(private readonly policies: BookingPolicyService) {}

  @Post()
  @ApiOperation({ summary: 'Create a draft of PUBLIC_BOOKING_DEFAULT. Does not change current policy.' })
  @ApiBody({ schema: bodySchema(policyContentSchema) })
  @ApiResponse({ status: 201, schema: bodySchema(policyView) })
  create(@ActiveUser('id') actorId: string, @Body(new ZodValidationPipe(policyContentSchema)) body: PolicyContent) {
    return this.policies.create(actorId, body)
  }

  @Get()
  @ApiOperation({ summary: 'List policy versions, including drafts and retired versions' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'state', required: false, enum: ['ALL', 'DRAFT', 'CURRENT', 'RETIRED'] })
  @ApiResponse({
    status: 200,
    schema: bodySchema(
      z.object({
        items: z.array(policyView),
        total: z.number().int(),
        page: z.number().int(),
        pageSize: z.number().int(),
      }),
    ),
  })
  list(
    @ActiveUser('id') actorId: string,
    @Query(new ZodValidationPipe(policyPageSchema)) query: z.infer<typeof policyPageSchema>,
  ) {
    return this.policies.list(actorId, query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get policy version and revision' })
  @ApiResponse({ status: 200, schema: bodySchema(policyView) })
  detail(@ActiveUser('id') actorId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.policies.detail(actorId, id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Replace draft content only; send the current expectedRevision' })
  @ApiBody({ schema: bodySchema(policyUpdateSchema) })
  @ApiResponse({ status: 200, schema: bodySchema(policyView) })
  update(
    @ActiveUser('id') actorId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(policyUpdateSchema)) body: z.infer<typeof policyUpdateSchema>,
  ) {
    const { expectedRevision, ...content } = body
    return this.policies.update(actorId, id, expectedRevision, content)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an unpublished draft only; published history cannot be deleted' })
  @ApiResponse({ status: 200, schema: bodySchema(z.object({ id: z.string().uuid(), deleted: z.literal(true) })) })
  @ApiBody({ schema: bodySchema(policyRevisionSchema) })
  remove(
    @ActiveUser('id') actorId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(policyRevisionSchema)) body: z.infer<typeof policyRevisionSchema>,
  ) {
    return this.policies.remove(actorId, id, body.expectedRevision)
  }

  @Post(':id/publish')
  @ApiOperation({
    summary: 'Publish draft now and atomically retire the previous policy. Repeated publication is safe.',
  })
  @ApiResponse({ status: 201, schema: bodySchema(policyView) })
  @ApiBody({ schema: bodySchema(policyRevisionSchema) })
  publish(
    @ActiveUser('id') actorId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(policyRevisionSchema)) body: z.infer<typeof policyRevisionSchema>,
  ) {
    return this.policies.publish(actorId, id, body.expectedRevision)
  }
}
