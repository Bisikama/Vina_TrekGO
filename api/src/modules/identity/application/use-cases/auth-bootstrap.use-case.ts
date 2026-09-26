import { Inject, Injectable } from '@nestjs/common'
import { I_USER_REPOSITORY } from '../ports/user.port'
import type { IUserRepository } from '../ports/user.port'
import { UserRole, UserStatus } from 'src/shared/constants'

@Injectable()
export class AuthBootstrapUseCase {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {}

  async execute(body: {
    authUserId: string
    email: string
    fullName?: string
    phone?: string
    avatarUrl?: string
    role?: string
  }) {
    const existing = await this.userRepository.findByEmailOrAuthId(body.email, body.authUserId)

    if (existing) {
      return existing
    }

    return await this.userRepository.create({
      authUserId: body.authUserId,
      email: body.email,
      fullName: body.fullName || body.email.split('@')[0],
      phone: body.phone,
      avatarUrl: body.avatarUrl,
      role: body.role ?? UserRole.USER,
      status: UserStatus.ACTIVE,
    })
  }
}
