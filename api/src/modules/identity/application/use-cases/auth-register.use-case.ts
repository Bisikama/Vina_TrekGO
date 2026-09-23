import {
  Inject,
  Injectable,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { I_IDENTITY_PROVIDER } from '../ports/identity.port'
import type { IIdentityProvider } from '../ports/identity.port'
import { I_USER_REPOSITORY } from '../ports/user.port'
import type { IUserRepository } from '../ports/user.port'
import { isUniqueConstraintPrismaError } from 'src/shared/helpers'
import { UserRole, UserStatus } from 'src/shared/constants'

@Injectable()
export class AuthRegisterUseCase {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_IDENTITY_PROVIDER) private readonly identityProvider: IIdentityProvider,
  ) {}

  async execute(body: {
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

    const password = body.password || 'TrekGo@123456'
    
    // 1. Tạo tài khoản trên Identity Provider (Supabase)
    const identityUser = await this.identityProvider.createUser({
      email: body.email,
      password,
      fullName: body.fullName || body.name,
      phone: body.phone,
    })

    const authUserId = identityUser.id

    // 2. Tạo hồ sơ người dùng trong Database (Postgres)
    try {
      const user = await this.userRepository.create({
        authUserId,
        email: body.email,
        fullName: body.fullName || body.name || body.email.split('@')[0],
        phone: body.phone,
        cccd: body.cccd,
        avatar: body.avatar,
        role: body.role ?? UserRole.USER,
        status: UserStatus.ACTIVE,
      })

      // 3. Đăng nhập để lấy token
      const signInData = await this.identityProvider.signInWithPassword(body.email, password)

      return {
        user,
        accessToken: signInData.session.accessToken,
        refreshToken: signInData.session.refreshToken,
        expiresIn: signInData.session.expiresIn,
        expiresAt: signInData.session.expiresAt,
        tokenType: signInData.session.tokenType,
      }
    } catch (error) {
      // Rollback: Xóa user trên Identity Provider nếu lưu DB thất bại
      await this.identityProvider.deleteUser(authUserId)

      if (isUniqueConstraintPrismaError(error)) {
        throw new ConflictException('Email hoặc số CCCD đã tồn tại trong hệ thống')
      }
      throw error
    }
  }
}
