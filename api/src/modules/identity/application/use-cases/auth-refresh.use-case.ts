import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { I_IDENTITY_PROVIDER } from '../ports/identity.port'
import type { IIdentityProvider } from '../ports/identity.port'

@Injectable()
export class AuthRefreshUseCase {
  constructor(
    @Inject(I_IDENTITY_PROVIDER) private readonly identityProvider: IIdentityProvider,
  ) {}

  async execute(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token là bắt buộc')
    }

    const session = await this.identityProvider.refreshSession(refreshToken)

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
      expiresAt: session.expiresAt,
      tokenType: session.tokenType,
    }
  }
}
