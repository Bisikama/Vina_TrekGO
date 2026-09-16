import { Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { AuthType } from 'src/shared/constants/auth.constant'
import { LoginDto, LogoutDto, RefreshTokenDto, RegisterDto } from './auth.dto'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Đăng ký tài khoản người dùng mới' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công, trả về user và tokens' })
  @ApiResponse({ status: 409, description: 'Email hoặc CCCD đã tồn tại' })
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return await this.authService.register(body)
  }

  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Đăng nhập vào hệ thống' })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công, trả về tokens' })
  @ApiResponse({ status: 401, description: 'Email hoặc mật khẩu không chính xác' })
  @Post('login')
  async login(@Body() body: LoginDto) {
    return await this.authService.login(body)
  }

  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Làm mới Access Token' })
  @ApiResponse({ status: 200, description: 'Cấp mới cặp tokens thành công' })
  @ApiResponse({ status: 401, description: 'Refresh token không hợp lệ hoặc đã hết hạn' })
  @Post('refresh-token')
  async refreshToken(@Body() body: RefreshTokenDto) {
    return await this.authService.refreshToken(body.refreshToken)
  }

  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Đăng xuất khỏi hệ thống' })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  @Post('logout')
  async logout(@Body() body: LogoutDto) {
    return await this.authService.logout(body.refreshToken)
  }
}
