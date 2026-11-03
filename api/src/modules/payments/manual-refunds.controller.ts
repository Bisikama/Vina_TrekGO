import { Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'
import { z } from 'zod'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { Roles } from '../../shared/decorators/roles.decorator'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
import type { ActiveUserData } from '../../shared/types/user.type'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { ManualRefundsService } from './manual-refunds.service'
import { MANUAL_REFUND_DETAIL_SCHEMA, MANUAL_REFUND_LIST_SCHEMA } from './manual-refund.swagger'
import {
  claimSchema,
  completeSchema,
  manualRefundKey,
  recipientSchema,
  refundQuerySchema,
  reassignSchema,
  releaseSchema,
  reviewSchema,
  type ManualAction,
  type ManualActionBody,
  type RefundQuery,
} from './dtos/manual-refund.dto'

const uuid = new ZodValidationPipe(z.string().uuid())
const keyPipe = new ZodValidationPipe(manualRefundKey)
function requestSchema(schema: z.ZodType) {
  const { $schema, ...result } = z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input' })
  return result as SchemaObject
}
const mutationDocs =
  (schema: z.ZodType, summary: string, description: string): MethodDecorator =>
  (target, property, descriptor) => {
    HttpCode(200)(target, property, descriptor)
    ApiOperation({ summary, description })(target, property, descriptor)
    ApiBody({ required: true, schema: requestSchema(schema) })(target, property, descriptor)
    ApiParam({ name: 'id', format: 'uuid', description: 'Shared Refund ID' })(target, property, descriptor)
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      description: '1–200 ASCII characters; exact replay returns the stored result, changed payload returns 409',
    })(target, property, descriptor)
    ApiResponse({
      status: 200,
      schema: MANUAL_REFUND_DETAIL_SCHEMA,
      description:
        'Refund detail with executionMode, confirmationSource, manualRefund (status/version/recipient/assignment), availableActions',
    })(target, property, descriptor)
    ApiResponse({ status: 400, description: 'Validation error in the shared error envelope' })(
      target,
      property,
      descriptor,
    )
    ApiResponse({ status: 404, description: 'Resource unavailable to this actor' })(target, property, descriptor)
    ApiResponse({ status: 409, description: 'Version, state, assignment, idempotency or bank-transfer conflict' })(
      target,
      property,
      descriptor,
    )
  }
const listDocs = (): MethodDecorator => (target, property, descriptor) => {
  ApiResponse({ status: 200, schema: MANUAL_REFUND_LIST_SCHEMA })(target, property, descriptor)
  ApiOperation({
    summary: 'List refunds',
    description:
      'Paginated, newest first. User lists are restricted to their own invoices. Account numbers are masked.',
  })(target, property, descriptor)
  for (const name of ['page', 'pageSize', 'source', 'purpose', 'manualStatus', 'assignedAdminId'])
    ApiQuery({ name, required: false, type: ['page', 'pageSize'].includes(name) ? Number : String })(
      target,
      property,
      descriptor,
    )
}

@Controller('refunds')
@ApiTags('Refunds')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
export class ManualRefundsController {
  constructor(private readonly refunds: ManualRefundsService) {}

  @Get()
  @listDocs()
  list(@ActiveUser() actor: ActiveUserData, @Query(new ZodValidationPipe(refundQuerySchema)) query: RefundQuery) {
    return this.refunds.list(actor, query)
  }

  @Put(':id/recipient')
  @mutationDocs(
    recipientSchema,
    'Declare the manual refund recipient',
    'Invoice owner only. Account must belong to the owner; ownership is declared by the user and checked by the admin, not bank-verified. Recipient locks after claim.',
  )
  recipient(
    @Param('id', uuid) id: string,
    @ActiveUser() actor: ActiveUserData,
    @Headers('idempotency-key') key: string,
    @Body(new ZodValidationPipe(recipientSchema)) body: z.infer<typeof recipientSchema>,
  ) {
    keyPipe.transform(key, { type: 'custom' })
    return this.refunds.mutate(id, actor, key, 'recipient', body)
  }
}

@Controller('admin/manual-refunds')
@ApiTags('Admin Manual Refunds')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Roles('ADMIN')
export class AdminManualRefundsController {
  constructor(private readonly refunds: ManualRefundsService) {}

  @Get()
  @listDocs()
  list(@ActiveUser() actor: ActiveUserData, @Query(new ZodValidationPipe(refundQuerySchema)) query: RefundQuery) {
    return this.refunds.list(actor, query, true)
  }

  @Get(':id')
  @ApiResponse({ status: 200, schema: MANUAL_REFUND_DETAIL_SCHEMA })
  @ApiOperation({
    summary: 'Manual refund detail',
    description:
      'Includes original payment, allocations, assignment, action history and downstream settlement processing status. Full bank details are restricted to owner/admin.',
  })
  detail(@Param('id', uuid) id: string, @ActiveUser() actor: ActiveUserData) {
    return this.refunds.detail(id, actor, true)
  }

  private run(id: string, actor: ActiveUserData, key: string, action: ManualAction, body: ManualActionBody) {
    keyPipe.transform(key, { type: 'custom' })
    return this.refunds.mutate(id, actor, key, action, body)
  }

  @Post(':id/claim')
  @mutationDocs(
    claimSchema,
    'Claim a manual refund',
    'Check recipient name against invoice owner before claiming. Claim persists until explicitly released or reassigned; only assignee may complete.',
  )
  claim(
    @Param('id', uuid) id: string,
    @ActiveUser() actor: ActiveUserData,
    @Headers('idempotency-key') key: string,
    @Body(new ZodValidationPipe(claimSchema)) body: z.infer<typeof claimSchema>,
  ) {
    return this.run(id, actor, key, 'claim', body)
  }

  @Post(':id/release')
  @mutationDocs(
    releaseSchema,
    'Release an untransferred refund',
    'Assignee only; must explicitly confirm no transfer occurred. A refund in NEEDS_REVIEW cannot be released.',
  )
  release(
    @Param('id', uuid) id: string,
    @ActiveUser() actor: ActiveUserData,
    @Headers('idempotency-key') key: string,
    @Body(new ZodValidationPipe(releaseSchema)) body: z.infer<typeof releaseSchema>,
  ) {
    return this.run(id, actor, key, 'release', body)
  }

  @Post(':id/review')
  @mutationDocs(
    reviewSchema,
    'Flag an uncertain bank transfer',
    'Keeps assignee and reserved funds. Check bank history before completing; do not transfer again while outcome is unknown.',
  )
  review(
    @Param('id', uuid) id: string,
    @ActiveUser() actor: ActiveUserData,
    @Headers('idempotency-key') key: string,
    @Body(new ZodValidationPipe(reviewSchema)) body: z.infer<typeof reviewSchema>,
  ) {
    return this.run(id, actor, key, 'review', body)
  }

  @Post(':id/reassign')
  @mutationDocs(
    reassignSchema,
    'Reassign manual refund for investigation',
    'Admin only, reason required. Target must be an active admin; status becomes NEEDS_REVIEW. Original claim time and locked recipient are preserved.',
  )
  reassign(
    @Param('id', uuid) id: string,
    @ActiveUser() actor: ActiveUserData,
    @Headers('idempotency-key') key: string,
    @Body(new ZodValidationPipe(reassignSchema)) body: z.infer<typeof reassignSchema>,
  ) {
    return this.run(id, actor, key, 'reassign', body)
  }

  @Post(':id/complete')
  @mutationDocs(
    completeSchema,
    'Confirm a completed manual bank transfer',
    'Assignee only, after checking bank success. Exact approved VND amount and unique bank reference required; optional evidenceMediaId. ADMIN_MANUAL confirmation is not independent bank/provider verification. Refund settlement and outbox are atomic; rental settlement may follow asynchronously.',
  )
  complete(
    @Param('id', uuid) id: string,
    @ActiveUser() actor: ActiveUserData,
    @Headers('idempotency-key') key: string,
    @Body(new ZodValidationPipe(completeSchema)) body: z.infer<typeof completeSchema>,
  ) {
    return this.run(id, actor, key, 'complete', body)
  }
}
