import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { HashingService } from 'src/shared/services/hashing.service'
import { TokenService } from 'src/shared/services/token.service'
import { isNotFoundError, isUniqueConstraintPrismaError } from 'src/shared/helpers'
import { UserRole, UserStatus } from 'src/shared/constants'

@Injectable()
export class AuthService {
  constructor(
    private readonly hashingService: HashingService,
    private readonly prismaService: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Tạo cặp Access Token và Refresh Token cho người dùng và lưu vào database
   */
  async generateTokens(payload: { userId: string }) {
    const accessToken = this.tokenService.signAccessToken(payload)
    const refreshToken = this.tokenService.signRefreshToken(payload)

    const decodedRefreshToken = await this.tokenService.verifyRefreshToken(refreshToken)

    await this.prismaService.refreshToken.create({
      data: {
        token: refreshToken,
        userId: payload.userId,
        expiresAt: new Date(decodedRefreshToken.exp * 1000),
        isRevoked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

    return { accessToken, refreshToken }
  }

  /**
   * Đăng ký tài khoản mới
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
    try {
      if (!body.email || !body.password) {
        throw new UnprocessableEntityException('Email và mật khẩu là bắt buộc')
      }

      const hashingPass = await this.hashingService.hash(body.password)

      const user = await this.prismaService.user.create({
        data: {
          email: body.email,
          passwordHash: hashingPass,
          fullName: body.fullName ?? body.name,
          phone: body.phone,
          cccd: body.cccd,
          avatar: body.avatar,
          role: body.role ?? UserRole.USER,
          status: UserStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        select: {
          id: true,
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

      const tokens = await this.generateTokens({ userId: user.id })

      return {
        user,
        ...tokens,
      }
    } catch (error) {
      if (isUniqueConstraintPrismaError(error)) {
        throw new ConflictException('Email hoặc số CCCD đã tồn tại trong hệ thống')
      }
      throw error
    }
  }

  /**
   * Đăng nhập
   */
  async login(body: { email: string; password?: string }) {
    if (!body.email || !body.password) {
      throw new UnprocessableEntityException('Email và mật khẩu là bắt buộc')
    }

    const user = await this.prismaService.user.findUnique({
      where: {
        email: body.email,
      },
    })

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác')
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Tài khoản chưa thiết lập mật khẩu')
    }

    const isPasswordValid = await this.hashingService.compare(body.password, user.passwordHash)
    if (!isPasswordValid) {
      throw new UnprocessableEntityException([
        {
          field: 'password',
          message: 'Mật khẩu không chính xác',
        },
      ])
    }

    const tokens = await this.generateTokens({ userId: user.id })
    // Loại bỏ passwordHash trước khi trả về client
     
    const { passwordHash, ...userWithoutPassword } = user

    return {
      user: userWithoutPassword,
      ...tokens,
    }
  }

  /**
   * Làm mới Access Token bằng Refresh Token
   */
  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token là bắt buộc')
    }

    let decoded
    try {
      decoded = await this.tokenService.verifyRefreshToken(refreshToken)
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn')
    }

    const storedToken = await this.prismaService.refreshToken.findUnique({
      where: {
        token: refreshToken,
      },
    })

    if (!storedToken || storedToken.isRevoked) {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã bị thu hồi')
    }

    // Xóa refresh token cũ để tránh reuse token
    await this.prismaService.refreshToken.delete({
      where: {
        token: refreshToken,
      },
    })

    return this.generateTokens({ userId: decoded.userId })
  }

  /**
   * Đăng xuất
   */
  async logout(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token là bắt buộc')
    }

    try {
      await this.tokenService.verifyRefreshToken(refreshToken)
      await this.prismaService.refreshToken.deleteMany({
        where: {
          token: refreshToken,
        },
      })
      return { message: 'Đăng xuất thành công' }
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new UnauthorizedException('Refresh token đã bị thu hồi hoặc không tồn tại')
      }
      throw new UnauthorizedException('Refresh token không hợp lệ')
    }
  }
}
