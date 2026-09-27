import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { I_IDENTITY_PROVIDER, type IIdentityProvider } from '../ports/identity.port'
import { I_USER_REPOSITORY, type IUserRepository } from '../ports/user.port'

@Injectable()
export class AuthForgotPasswordUseCase {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_IDENTITY_PROVIDER) private readonly identityProvider: IIdentityProvider,
  ) {}

  async execute(email: string) {
    

    // 2. Kích hoạt flow gửi mail reset từ Provider (Supabase)
    await this.identityProvider.resetPasswordForEmail(email)

    return {
      message: 'Nếu email này tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn.',
    }
  }
}
