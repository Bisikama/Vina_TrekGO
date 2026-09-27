import { Inject, Injectable, BadRequestException } from '@nestjs/common'
import { I_IDENTITY_PROVIDER } from '../ports/identity.port'
import type { IIdentityProvider } from '../ports/identity.port'
import { I_USER_REPOSITORY } from '../ports/user.port'
import type { IUserRepository } from '../ports/user.port'

@Injectable()
export class AuthResendOtpUseCase {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_IDENTITY_PROVIDER) private readonly identityProvider: IIdentityProvider,
  ) {}

  async execute(email: string) {
    // 1. Nếu đã có trong DB rồi -> tức là đã xác thực xong rồi, không cần gửi OTP nữa
    const existingUser = await this.userRepository.findByEmail(email)
    if (existingUser) {
      throw new BadRequestException('Tài khoản này đã được kích hoạt rồi. Vui lòng đăng nhập.')
    }

    // 2. Gửi lại OTP
    await this.identityProvider.resendOtp(email)

    return {
      message: 'Mã xác thực OTP mới đã được gửi lại vào email của bạn.',
      email,
    }
  }
}
