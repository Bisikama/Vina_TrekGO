import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { SupabaseService } from 'src/shared/services/supabase.service'
import { isUniqueConstraintPrismaError } from 'src/shared/helpers'
import { UserRole, UserStatus } from 'src/shared/constants'

/**
 * AuthService - Pure Supabase Flow (docs/luat.md)
 * Supabase Auth là Identity Provider duy nhất, quản lý tài khoản và cấp phát Tokens
 * TrekGo Backend quản lý Profile, Role, Rank và dữ liệu nghiệp vụ
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Đăng ký tài khoản mới (Pure Supabase Flow)
   * 1. Tạo tài khoản trong Supabase Auth (auth.users)
   * 2. Lưu hồ sơ người dùng vào PostgreSQL (bảng users)
   * 3. Trả về thông tin Profile kèm Supabase Session Tokens
   */
  async register(body: {
    email: string
    password?: string
    fullName?: string
    name?: string
    phone?: string
    cccd?: string
    avatar?: string
    role?: string
  }) {
    if (!body.email) {
      throw new UnprocessableEntityException('Email là bắt buộc')
    }

    // 1. Tạo tài khoản trên Supabase Auth
    const password = body.password || 'TrekGo@123456'
    const supabaseUser = await this.supabaseService.createUser({
      email: body.email,
      password,
      fullName: body.fullName || body.name,
      phone: body.phone,
    })

    const authUserId = supabaseUser.id

    // 2. Tạo hồ sơ người dùng trong TrekGo Database
    try {
      const user = await this.prismaService.user.create({
        data: {
          authUserId,
          email: body.email,
          fullName: body.fullName || body.name || body.email.split('@')[0],
          phone: body.phone,
          cccd: body.cccd,
          avatar: body.avatar,
          role: body.role ?? UserRole.USER,
          status: UserStatus.ACTIVE,
        },
        select: {
          id: true,
          authUserId: true,
          email: true,
          fullName: true,
          phone: true,
          cccd: true,
          role: true,
          status: true,
          avatar: true,
          createdAt: true,
        },
      })

      // 3. Đăng nhập qua Supabase để lấy token chính thức của Supabase
      const signInData = await this.supabaseService.signInWithPassword(body.email, password)

      return {
        user,
        accessToken: signInData.session?.access_token,
        refreshToken: signInData.session?.refresh_token,
        expiresIn: signInData.session?.expires_in,
        expiresAt: signInData.session?.expires_at,
        tokenType: signInData.session?.token_type ?? 'bearer',
      }
    } catch (error) {
      // Rollback: nếu lưu Postgres thất bại, xóa user trên Supabase để đảm bảo toàn vẹn
      await this.supabaseService.deleteUser(authUserId)

      if (isUniqueConstraintPrismaError(error)) {
        throw new ConflictException('Email hoặc số CCCD đã tồn tại trong hệ thống')
      }
      throw error
    }
  }

  /**
   * Bootstrap/Map thông tin tài khoản từ Supabase Auth (RC-API-005)
   * Khi Client (Mobile/Web) đăng ký qua Supabase SDK, gọi endpoint này để tạo profile
   */
  async bootstrap(body: {
    authUserId: string
    email: string
    fullName?: string
    phone?: string
    cccd?: string
    avatar?: string
    role?: string
  }) {
    const existing = await this.prismaService.user.findUnique({
      where: { authUserId: body.authUserId },
    })

    if (existing) {
      return existing
    }

    return await this.prismaService.user.create({
      data: {
        authUserId: body.authUserId,
        email: body.email,
        fullName: body.fullName || body.email.split('@')[0],
        phone: body.phone,
        cccd: body.cccd,
        avatar: body.avatar,
        role: body.role ?? UserRole.USER,
        status: UserStatus.ACTIVE,
      },
    })
  }

  /**
   * Đăng nhập (Pure Supabase Flow)
   * 1. Xác thực thông tin qua Supabase Auth
   * 2. Lấy hoặc tự động bootstrap TrekGo Profile
   * 3. Trả về Profile và Supabase Session Tokens
   */
  async login(body: { email: string; password?: string }) {
    if (!body.email) {
      throw new UnprocessableEntityException('Email là bắt buộc')
    }
    if (!body.password) {
      throw new UnprocessableEntityException('Mật khẩu là bắt buộc')
    }

    // 1. Xác thực thông tin đăng nhập trực tiếp qua Supabase Auth
    const supabaseData = await this.supabaseService.signInWithPassword(body.email, body.password)
    const authUserId = supabaseData.user?.id

    if (!authUserId) {
      throw new UnauthorizedException('Không thể xác thực thông tin tài khoản')
    }

    // 2. Tìm Profile trong Database TrekGo (PostgreSQL)
    let user = await this.prismaService.user.findFirst({
      where: {
        OR: [{ authUserId }, { email: body.email }],
      },
      include: {
        leaderProfile: true,
        userRank: true,
      },
    })

    // 3. Tự động tạo profile nếu user đã có tài khoản trên Supabase nhưng chưa có trong TrekGo DB
    if (!user) {
      user = await this.prismaService.user.create({
        data: {
          authUserId,
          email: body.email,
          fullName: body.email.split('@')[0],
          status: UserStatus.ACTIVE,
          role: UserRole.USER,
        },
        include: {
          leaderProfile: true,
          userRank: true,
        },
      })
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản đã bị tạm khóa')
    }

    return {
      user,
      accessToken: supabaseData.session?.access_token,
      refreshToken: supabaseData.session?.refresh_token,
      expiresIn: supabaseData.session?.expires_in,
      expiresAt: supabaseData.session?.expires_at,
      tokenType: supabaseData.session?.token_type ?? 'bearer',
    }
  }

  /**
   * Làm mới Access Token bằng Refresh Token qua Supabase Auth (RC-FR-007)
   */
  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token là bắt buộc')
    }

    const session = await this.supabaseService.refreshSession(refreshToken)

    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
      expiresAt: session.expires_at,
      tokenType: session.token_type ?? 'bearer',
    }
  }

  /**
   * Đăng xuất qua Supabase Auth (RC-API-003)
   */
  async logout(refreshToken?: string) {
    await this.supabaseService.signOut()
    return { message: 'Đăng xuất thành công' }
  }

  /**
   * Lấy thông tin user hiện tại (RC-API-004)
   */
  async getMe(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      include: {
        leaderProfile: true,
        userRank: true,
      },
    })

    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại')
    }

    return user
  }
}

