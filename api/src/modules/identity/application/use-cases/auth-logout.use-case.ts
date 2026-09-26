import { Inject, Injectable } from '@nestjs/common'
import { I_IDENTITY_PROVIDER } from '../ports/identity.port'
import type { IIdentityProvider } from '../ports/identity.port'

@Injectable()
export class AuthLogoutUseCase {
  constructor(
    @Inject(I_IDENTITY_PROVIDER) private readonly identityProvider: IIdentityProvider,
  ) {}

  async execute(accessToken?: string) {
    await this.identityProvider.signOut(accessToken)
    return { message: 'Đăng xuất thành công' }
  }
}
