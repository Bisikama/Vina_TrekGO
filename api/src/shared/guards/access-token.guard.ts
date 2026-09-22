import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { SupabaseService } from '../services/supabase.service'
import { PrismaService } from '../services/prisma.service'
import { REQUEST_USER_KEY } from '../constants/auth.constant'
import { UserStatus } from '../constants'

/**
 * AccessTokenGuard - Pure Supabase Flow
 * Xác thực Bearer Token trực tiếp qua Supabase Auth (Identity Provider)
 * Ánh xạ auth_user_id (Supabase UID) -> TrekGo User Profile trong PostgreSQL
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const accessToken = request.headers.authorization?.split(' ')[1]

    if (!accessToken) {
      throw new UnauthorizedException('Thiếu Bearer Access Token trong Authorization header')
    }

    try {
      // 1. Xác thực token với Supabase Auth
      const supabaseUser = await this.supabaseService.verifyToken(accessToken)
      if (!supabaseUser) {
        throw new UnauthorizedException('Token Supabase không hợp lệ')
      }

      // 2. Tìm Profile TrekGo tương ứng qua authUserId
      const trekGoUser = await this.prismaService.user.findUnique({
        where: { authUserId: supabaseUser.id },
        include: {
          leaderProfile: true,
          userRank: true,
        },
      })

      if (trekGoUser && trekGoUser.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException('Tài khoản đã bị tạm khóa')
      }

      // 3. Đính kèm user thông tin vào request
      request[REQUEST_USER_KEY] = trekGoUser ?? {
        id: '',
        authUserId: supabaseUser.id,
        email: supabaseUser.email,
        role: 'USER',
        status: 'ACTIVE',
      }
      return true
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error
      }
      throw new UnauthorizedException('Access Token Supabase không hợp lệ hoặc đã hết hạn')
    }
  }
}

