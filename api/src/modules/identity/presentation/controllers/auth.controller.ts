import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
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
} from '../dtos/auth.dto'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { AuthRegisterUseCase } from '../../application/use-cases/auth-register.use-case'
import { AuthLoginUseCase } from '../../application/use-cases/auth-login.use-case'
import { AuthBootstrapUseCase } from '../../application/use-cases/auth-bootstrap.use-case'
import { AuthRefreshUseCase } from '../../application/use-cases/auth-refresh.use-case'
import { AuthLogoutUseCase } from '../../application/use-cases/auth-logout.use-case'
import { GetProfileUseCase } from '../../application/use-cases/get-profile.use-case'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authRegisterUseCase: AuthRegisterUseCase,
    private readonly authLoginUseCase: AuthLoginUseCase,
    private readonly authBootstrapUseCase: AuthBootstrapUseCase,
    private readonly authRefreshUseCase: AuthRefreshUseCase,
    private readonly authLogoutUseCase: AuthLogoutUseCase,
    private readonly getProfileUseCase: GetProfileUseCase,
  ) {}

  @Auth([AuthType.None])
  @ApiOperation({
    summary: 'Bootstrap/Map profile từ Supabase Auth (RC-API-005)',
    description: 'Sau khi user đăng ký/đăng nhập qua Supabase Auth SDK, gọi endpoint này để tạo hoặc lấy profile TrekGo',
  })
  @ApiResponse({ status: 201, description: 'Tạo hoặc đồng bộ profile thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ (Zod Validation)' })
  @Post('bootstrap')
  async bootstrap(@Body(new ZodValidationPipe(BootstrapSchema)) body: BootstrapDto) {
    return await this.authBootstrapUseCase.execute(body)
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
      return await this.getProfileUseCase.execute(user.id)
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
    return await this.authRegisterUseCase.execute(body)
  }

  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Đăng nhập vào hệ thống' })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công, trả về tokens' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ (Zod Validation)' })
  @ApiResponse({ status: 401, description: 'Email hoặc mật khẩu không chính xác' })
  @Post('login')
  async login(@Body(new ZodValidationPipe(LoginSchema)) body: LoginDto) {
    return await this.authLoginUseCase.execute(body)
  }

  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Làm mới Access Token (RC-FR-007)' })
  @ApiResponse({ status: 200, description: 'Cấp mới tokens thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ (Zod Validation)' })
  @ApiResponse({ status: 401, description: 'Refresh token không hợp lệ hoặc đã hết hạn' })
  @Post('refresh-token')
  async refreshToken(@Body(new ZodValidationPipe(RefreshTokenSchema)) body: RefreshTokenDto) {
    return await this.authRefreshUseCase.execute(body.refreshToken)
  }

  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Đăng xuất khỏi hệ thống (RC-API-003)' })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  @Post('logout')
  async logout(@Body(new ZodValidationPipe(LogoutSchema)) body: LogoutDto) {
    const req = arguments[1] // Dùng auth token nếu có thể
    return await this.authLogoutUseCase.execute(body.refreshToken)
  }
}
