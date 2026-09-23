import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { I_USER_REPOSITORY } from '../ports/user.port'
import type { IUserRepository } from '../ports/user.port'

@Injectable()
export class GetProfileUseCase {
  constructor(
    @Inject(I_USER_REPOSITORY) private readonly userRepository: IUserRepository,
  ) {}

  async execute(userId: string) {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại')
    }

    return user
  }
}
