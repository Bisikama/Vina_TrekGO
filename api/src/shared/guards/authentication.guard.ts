 
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { CanActivate, ExecutionContext } from '@nestjs/common'
import { Observable } from 'rxjs'
import { TokenService } from '../services/token.service'
import { AuthType, ConditonGuardType, REQUEST_USER_KEY } from '../constants/auth.constant'
import { Reflector } from '@nestjs/core'
import { AuthTypeDecorator, META_AUTH_KEY } from '../decorators/auth.decorator'
import { AccessTokenGuard } from './access-token.guard'
import { ApiKeyGuard } from './api-key.guard'

@Injectable()
export class AuthenticationGuard implements CanActivate {
  private readonly authTypeGuardMap: Record<string, CanActivate>
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokenGuard: AccessTokenGuard,
    private readonly apiKeyGuard: ApiKeyGuard,
  ) {
    this.authTypeGuardMap = {
      [AuthType.Bearer]: this.accessTokenGuard,
      [AuthType.ApiKey]: this.apiKeyGuard,
      [AuthType.None]: { canActivate: () => true },
    }
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authTypeValue = this.reflector.getAllAndOverride<AuthTypeDecorator | undefined>(META_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? { authTypes: [AuthType.None], options: { condition: ConditonGuardType.And } }

    const guards = authTypeValue.authTypes.map((authType) => this.authTypeGuardMap[authType])
    let error = new UnauthorizedException('Bạn không có quyền truy cập')
    if (authTypeValue?.options?.condition === ConditonGuardType.Or) {
      for (const instance of guards) {
        const canActivate = await Promise.resolve(instance.canActivate(context)).catch((err) => {
          error = err
          return false
        })
        if (canActivate) {
          return true
        }
      }
      throw error
    } else {
      for (const instance of guards) {
        const canActivate = await Promise.resolve(instance.canActivate(context)).catch((err) => {
          error = err
          return false
        })
        if (!canActivate) {
          throw error
        }
      }

      return true
    }
  }
}
