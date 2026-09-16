 
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { CanActivate, ExecutionContext } from '@nestjs/common'
import { Observable } from 'rxjs'
import { TokenService } from '../services/token.service'
import { REQUEST_USER_KEY } from '../constants/auth.constant'

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const accessToken = request.headers.authorization?.split(' ')[1]
    if (!accessToken) {
      throw new UnauthorizedException('Bạn không có quyền truy cập')
    }
    try {
      const decodeToken = await this.tokenService.verifyAccessToken(accessToken)
      request[REQUEST_USER_KEY] = decodeToken
      return true
    } catch (error) {
     throw new UnauthorizedException('Bạn không có quyền truy cập')
    }
  }
}
