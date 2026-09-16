 
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { CanActivate, ExecutionContext } from '@nestjs/common'
import { Observable } from 'rxjs'
import { TokenService } from '../services/token.service'
import { REQUEST_USER_KEY } from '../constants/auth.constant'

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private readonly tokenService: TokenService) { }
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest()
        const xAPIKey = request.headers['x-api-key']
        if (!xAPIKey) {
            throw new UnauthorizedException("Bạn không có quyền truy cập")
        }
        return true

    }
}
