import { Controller, Get, Header, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Auth } from '../../shared/decorators/auth.decorator'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { InvitationInboxService } from './invitation-inbox.service'

export const inboxQuery = z
  .object({
    type: z.enum(['PUBLIC', 'PRIVATE', 'ALL']).default('ALL'),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(2048).optional(),
  })
  .strict()
export type InboxQuery = z.infer<typeof inboxQuery>
const item = z.object({
  id: z.string().uuid(),
  type: z.enum(['PUBLIC', 'PRIVATE']),
  tripId: z.string().uuid(),
  tripTitle: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  storedStatus: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED', 'INVALIDATED']),
  previewRequired: z.literal(true),
})
export const inboxResponse = z.object({ items: z.array(item), nextCursor: z.string().nullable(), hasMore: z.boolean() })

@ApiTags('Invitation inbox')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('me/invitations')
export class InvitationInboxController {
  constructor(private readonly inbox: InvitationInboxService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Recipient inbox combining Public and Private invitations',
    description:
      'USER/LEADER ACTIVE. Keyset order createdAt/type/id descending. storedStatus is not an action or permission: fetch the type-specific preview for current status/actions. No status filter.',
  })
  @ApiQuery({ name: 'type', required: false, enum: ['ALL', 'PUBLIC', 'PRIVATE'] })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({ status: 200, schema: z.toJSONSchema(inboxResponse, { target: 'openapi-3.0' }) as any })
  @ApiResponse({ status: 400, description: 'Shared error/meta: invalid query or cursor/filter mismatch.' })
  @ApiResponse({ status: 401, description: 'Shared error/meta: authentication required.' })
  @ApiResponse({ status: 403, description: 'Shared error/meta: actor unavailable or disallowed role.' })
  list(@ActiveUser('id') userId: string, @Query(new ZodValidationPipe(inboxQuery)) query: InboxQuery) {
    return this.inbox.list(userId, query)
  }
}
