import { Inject, Injectable } from '@nestjs/common'
import { UserRole, UserStatus } from 'src/shared/constants'

// Tách riêng Token Inject (Value) và Interface (Type)
import { I_USER_REPOSITORY } from '../ports/user.port'
import type { IUserRepository } from '../ports/user.port'

import { I_IDENTITY_PROVIDER } from '../ports/identity.port'
import type { IIdentityProvider } from '../ports/identity.port'

@Injectable()
export class AuthVerifyOtpUseCase {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_IDENTITY_PROVIDER) private readonly identityProvider: IIdentityProvider,
  ) {}

  async execute(body: { email: string; otp: string }) {
    // 1. Xác thực OTP với Supabase
    const { user: identityUser, session } = await this.identityProvider.verifyOtp(body.email, body.otp)

    let user = await this.userRepository.findByEmail(body.email)

    if (!user) {
      user = await this.userRepository.create({
        authUserId: identityUser.id,
        email: body.email,
        fullName: body.email.split('@')[0],
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
      })
    }

    // 2. Trả về thông tin đăng nhập thành công
    return {
      user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
      expiresAt: session.expiresAt,
      tokenType: session.tokenType,
    }
  }
}
