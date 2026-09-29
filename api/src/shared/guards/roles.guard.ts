import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '../decorators/roles.decorator'
import { UserRole } from '../constants'
import { REQUEST_USER_KEY } from '../constants/auth.constant'
import { ActiveUserData } from '../types/user.type'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Lấy danh sách role được phép từ metadata (@Roles)
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // Nếu API không gắn @Roles() thì cho phép qua (chỉ cần Authenticated)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true
    }

    // 2. Lấy thông tin user hiện tại (được AccessTokenGuard gán vào trước đó)
    const request = context.switchToHttp().getRequest()
    const user: ActiveUserData = request[REQUEST_USER_KEY]

    if (!user) {
      throw new ForbiddenException('Không xác định được danh tính người dùng')
    }

    // 3. Kiểm tra Role từ Database PostgreSQL
    const hasRole = requiredRoles.includes(user.role as UserRole)
    if (!hasRole) {
      throw new ForbiddenException(
        `Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền: [${requiredRoles.join(', ')}]`,
      )
    }

    return true
  }
}
