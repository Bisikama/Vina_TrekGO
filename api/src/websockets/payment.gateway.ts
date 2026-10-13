import { MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({ namespace: '/payment' })
export class PaymentGateway {
  @WebSocketServer()
  server: Server
 
  @SubscribeMessage('send-money')
  handleEvent(@MessageBody() data: string): string {
    this.server.emit('receive-money', {
      data: `Payment success: ${data}`,
    })
    return data
  }
}