import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import envConfig from '../config'

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const xAPIKey = request.headers['x-api-key']

    if (!xAPIKey || xAPIKey !== envConfig.SECRET_API_KEY) {
      throw new UnauthorizedException('Secret API Key không hợp lệ hoặc thiếu trong request')
    }

    return true
  }
}

