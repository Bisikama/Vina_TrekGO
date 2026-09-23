import {
  Inject,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { I_IDENTITY_PROVIDER } from '../ports/identity.port'
import type { IIdentityProvider } from '../ports/identity.port'
import { I_USER_REPOSITORY } from '../ports/user.port'
import type { IUserRepository } from '../ports/user.port'
import { UserRole, UserStatus } from 'src/shared/constants'

@Injectable()
export class AuthLoginUseCase {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(I_IDENTITY_PROVIDER) private readonly identityProvider: IIdentityProvider,
  ) {}

  async execute(body: { email: string; password?: string }) {
    if (!body.email) {
      throw new UnprocessableEntityException('Email là bắt buộc')
    }
    if (!body.password) {
      throw new UnprocessableEntityException('Mật khẩu là bắt buộc')
    }

    // 1. Xác thực qua Identity Provider (Supabase)
    const { user: identityUser, session } = await this.identityProvider.signInWithPassword(
      body.email,
      body.password,
    )

    if (!identityUser.id) {
      throw new UnauthorizedException('Không thể xác thực thông tin tài khoản')
    }

    // 2. Tìm Profile trong Database
    let user = await this.userRepository.findByEmailOrAuthId(body.email, identityUser.id)

    // 3. Tự động bootstrap nếu chưa có profile
    if (!user) {
      user = await this.userRepository.create({
        authUserId: identityUser.id,
        email: body.email,
        fullName: body.email.split('@')[0],
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
      })
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản đã bị tạm khóa')
    }

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
