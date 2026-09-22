import { Body, Controller, Get, Post, Req, UsePipes } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { AuthType, REQUEST_USER_KEY } from 'src/shared/constants/auth.constant'
import {
  BootstrapDto,
  BootstrapSchema,
  LoginDto,
  LoginSchema,
  LogoutDto,
  LogoutSchema,
  RefreshTokenDto,
  RefreshTokenSchema,
  RegisterDto,
  RegisterSchema,
} from './auth.dto'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Auth([AuthType.None])
  @ApiOperation({
    summary: 'Bootstrap/Map profile từ Supabase Auth (RC-API-005)',
    description: 'Sau khi user đăng ký/đăng nhập qua Supabase Auth SDK, gọi endpoint này để tạo hoặc lấy profile TrekGo',
  })
  @ApiResponse({ status: 201, description: 'Tạo hoặc đồng bộ profile thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ (Zod Validation)' })
  @Post('bootstrap')
  async bootstrap(@Body(new ZodValidationPipe(BootstrapSchema)) body: BootstrapDto) {
    return await this.authService.bootstrap(body)
  }

  @Auth([AuthType.Bearer])
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy thông tin User hiện tại (RC-API-004)',
    description: 'Xác thực qua Bearer Token Supabase và trả về TrekGo User Profile',
  })
  @ApiResponse({ status: 200, description: 'Thông tin người dùng hiện tại' })
  @Get('me')
  async getMe(@Req() req: any) {
    const user = req[REQUEST_USER_KEY]
    if (user?.id) {
      return await this.authService.getMe(user.id)
    }
    return user
  }

  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Đăng ký tài khoản người dùng mới' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công, trả về user và tokens' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ (Zod Validation)' })
  @ApiResponse({ status: 409, description: 'Email hoặc CCCD đã tồn tại' })
  @Post('register')
  async register(@Body(new ZodValidationPipe(RegisterSchema)) body: RegisterDto) {
    return await this.authService.register(body)
  }

  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Đăng nhập vào hệ thống' })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công, trả về tokens' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ (Zod Validation)' })
  @ApiResponse({ status: 401, description: 'Email hoặc mật khẩu không chính xác' })
  @Post('login')
  async login(@Body(new ZodValidationPipe(LoginSchema)) body: LoginDto) {
    return await this.authService.login(body)
  }

  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Làm mới Access Token (RC-FR-007)' })
  @ApiResponse({ status: 200, description: 'Cấp mới tokens thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ (Zod Validation)' })
  @ApiResponse({ status: 401, description: 'Refresh token không hợp lệ hoặc đã hết hạn' })
  @Post('refresh-token')
  async refreshToken(@Body(new ZodValidationPipe(RefreshTokenSchema)) body: RefreshTokenDto) {
    return await this.authService.refreshToken(body.refreshToken)
  }

  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Đăng xuất khỏi hệ thống (RC-API-003)' })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  @Post('logout')
  async logout(@Body(new ZodValidationPipe(LogoutSchema)) body: LogoutDto) {
    return await this.authService.logout(body.refreshToken)
  }
}

