import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { InvitationRequestService } from '../../../../shared/services/invitation-request.service'
import { privateInvitationConfig } from '../../application/private-invitation.policy'
@Injectable()
export class PrivateInvitationRequestService extends InvitationRequestService {
  constructor(db: PrismaService) {
    super(db, 'private', privateInvitationConfig)
  }
}
