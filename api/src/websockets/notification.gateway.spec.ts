import { NotificationGateway } from './notification.gateway'

describe('NotificationGateway authentication', () => {
  const verifyToken = jest.fn()
  const findUnique = jest.fn()
  let middleware: (socket: any, next: (error?: Error) => void) => void

  beforeEach(() => {
    jest.resetAllMocks()
    const gateway = new NotificationGateway({ verifyToken } as never, { user: { findUnique } } as never)
    gateway.afterInit({ use: (fn: typeof middleware) => { middleware = fn } } as never)
  })

  async function connect(token?: string) {
    const socket = { handshake: { auth: { token } }, data: {} as Record<string, unknown> }
    const error = await new Promise<Error | undefined>((resolve) => middleware(socket, resolve))
    return { error, socket }
  }

  it('rejects missing tokens and inactive accounts', async () => {
    expect((await connect()).error).toBeInstanceOf(Error)
    verifyToken.mockResolvedValue({ id: 'auth-1' })
    findUnique.mockResolvedValue({ id: 'user-1', status: 'SUSPENDED' })
    expect((await connect('token')).error).toBeInstanceOf(Error)
  })

  it('accepts only a verified active user', async () => {
    verifyToken.mockResolvedValue({ id: 'auth-1' })
    findUnique.mockResolvedValue({ id: 'user-1', status: 'ACTIVE' })
    const { error, socket } = await connect('token')
    expect(error).toBeUndefined()
    expect(socket.data.userId).toBe('user-1')
  })

  it('rejects invalid tokens', async () => {
    verifyToken.mockRejectedValue(new Error('invalid'))
    expect((await connect('bad-token')).error).toBeInstanceOf(Error)
    expect(findUnique).not.toHaveBeenCalled()
  })
})
