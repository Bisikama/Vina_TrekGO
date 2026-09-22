import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import { ActiveUserData } from '../types/user.type'
import { REQUEST_USER_KEY } from '../constants/auth.constant'

export const ActiveUser = createParamDecorator(
  (field: keyof ActiveUserData | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest()
    const user: ActiveUserData | undefined = request[REQUEST_USER_KEY]
    return field ? user?.[field] : user
  },
)

