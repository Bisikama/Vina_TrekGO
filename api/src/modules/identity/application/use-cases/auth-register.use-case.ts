import { Inject, Injectable, ConflictException, UnprocessableEntityException } from '@nestjs/common'
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
    phone?: string
    avatar?: string
    role?: string
  }) {
    if (!body.email) {
      throw new UnprocessableEntityException('Email là bắt buộc')
    }
    

    const password = body.password || 'TrekGo@123456'

    // 1. Đăng ký trên Supabase Auth (Supabase tự động gửi mã OTP qua email)
    const identityUser = await this.identityProvider.signUp({
      email: body.email,
      password,
      fullName: body.fullName,
      phone: body.phone,
    })

    return {
      message: 'Mã xác thực OTP đã được gửi đến email của bạn. Vui lòng xác thực để kích hoạt tài khoản.',
      email: body.email,
      userId: identityUser.id,
    }
  }
}
