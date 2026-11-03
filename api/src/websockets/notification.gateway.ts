import { OnGatewayInit, WebSocketGateway } from '@nestjs/websockets'
import { Namespace } from 'socket.io'
import { PrismaService } from '../shared/services/prisma.service'
import { SupabaseService } from '../shared/services/supabase.service'


// name space "/notifications"
@WebSocketGateway({ namespace: '/notifications' })
export class NotificationGateway implements OnGatewayInit {
  constructor(private readonly supabase: SupabaseService, private readonly prisma: PrismaService) {}

  afterInit(server: Namespace) {
    server.use((socket, next) => {
      void (async () => {
        try {
          const token = socket.handshake.auth?.token
          if (typeof token !== 'string' || !token) throw new Error('Missing token')
          const identity = await this.supabase.verifyToken(token)
          const user = await this.prisma.user.findUnique({ where: { authUserId: identity.id } })
          if (!user || user.status !== 'ACTIVE') throw new Error('Inactive user')
          socket.data.userId = user.id
          next()
        } catch {
          next(new Error('Notification authentication failed'))
        }
      })()
    })
  }
}
