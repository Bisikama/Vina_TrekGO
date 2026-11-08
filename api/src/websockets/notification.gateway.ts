import { Logger } from '@nestjs/common'
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { Namespace, Socket } from 'socket.io'
import { PrismaService } from '../shared/services/prisma.service'
import { SupabaseService } from '../shared/services/supabase.service'

export const NOTIFICATION_SOCKET_EVENTS = {
  NEW: 'receive-notifications',
} as const

const userRoom = (userId: string) => `user:${userId}`

// name space "/notifications"
@WebSocketGateway({ namespace: '/notifications' })
export class NotificationGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(NotificationGateway.name)
  @WebSocketServer() private server?: Namespace

  constructor(private readonly supabase: SupabaseService, private readonly prisma: PrismaService) {}

  afterInit(server: Namespace) {
    // Supabase chỉ được gọi một lần lúc bắt tay; các lần emit sau chỉ là thao tác trong bộ nhớ.
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

  handleConnection(socket: Socket) {
    const userId = socket.data?.userId
    if (typeof userId === 'string') void socket.join(userRoom(userId))
  }

  /** Đẩy thông báo mới tới mọi kết nối của user. Lỗi socket không được làm hỏng luồng lưu thông báo. */
  emitToUser(userId: string, event: string, payload: unknown) {
    try {
      this.server?.to(userRoom(userId)).emit(event, payload)
    } catch {
      this.logger.warn(`Notification socket emit failed: ${event}`)
    }
  }
}
