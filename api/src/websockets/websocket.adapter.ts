import { IoAdapter } from '@nestjs/platform-socket.io'
import { Server, ServerOptions, Socket } from 'socket.io'

export class WebsocketAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): any {
    const server: Server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        credentials: true,
      },
    })

    // cach 1 khai bao' cho tung namespace
    // server.of('/payment').use(authMiddleware)
    // server.of('/notification').use(authMiddleware)
    //cach 2 khai bao cho tat ca cac namespace
    server.use((socket, next) => {
      this.authMiddleware(socket, next)
    })
    server.of(/.*/).use((socket, next) => {
      this.authMiddleware(socket, next)
    })
    return server
  }
  authMiddleware(socket: Socket, next: (err?: any) => void) {
    console.log(socket.handshake)
    console.log('new connection', socket.id)
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`)
    })
    next()
  }
}
