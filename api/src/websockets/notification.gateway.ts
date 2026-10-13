import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { Server } from 'socket.io'


// name space "/notifications"
@WebSocketGateway({ namespace: '/notifications' })
export class NotificationGateway {
  @WebSocketServer()
  server: Server
  @SubscribeMessage('send-message')
  handleEvent(@MessageBody() data: string): string {
    this.server.emit('receive-message', {
      data: `hello ${data}`,
    })
    return data
  }
}
