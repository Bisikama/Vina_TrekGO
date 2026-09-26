import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Auth } from 'src/shared/decorators/auth.decorator'
import { AuthType, REQUEST_USER_KEY } from 'src/shared/constants/auth.constant'
import {
  BootstrapDto,
  BootstrapSchema,
  ForgotPasswordDto,
  ForgotPasswordSchema,
  LoginDto,
  LoginSchema,
  LogoutDto,
  LogoutSchema,
  RefreshTokenDto,
  RefreshTokenSchema,
  RegisterDto,
  RegisterSchema,
  ResendOtpDto,
  ResendOtpSchema,
  VerifyOtpDto,
  VerifyOtpSchema,
} from '../dtos/auth.dto'
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe'
import { AuthRegisterUseCase } from '../../application/use-cases/auth-register.use-case'
import { AuthLoginUseCase } from '../../application/use-cases/auth-login.use-case'
import { AuthBootstrapUseCase } from '../../application/use-cases/auth-bootstrap.use-case'
import { AuthRefreshUseCase } from '../../application/use-cases/auth-refresh.use-case'
import { AuthLogoutUseCase } from '../../application/use-cases/auth-logout.use-case'
import { GetProfileUseCase } from '../../application/use-cases/get-profile.use-case'
import { AuthForgotPasswordUseCase } from '../../application/use-cases/auth-forgot-password.use-case'
import { AuthVerifyOtpUseCase } from '../../application/use-cases/auth-verify-otp.use-case'
import { AuthResendOtpUseCase } from '../../application/use-cases/auth-resend-otp.use-case'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import type { ActiveUserData } from 'src/shared/types/user.type'
import { Roles } from 'src/shared/decorators/roles.decorator'
import { UserRole } from 'src/shared/constants'

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
    private readonly authForgotPasswordUseCase: AuthForgotPasswordUseCase,
    private readonly authVerifyOtpUseCase: AuthVerifyOtpUseCase,
    private readonly authResendOtpUseCase: AuthResendOtpUseCase,
  ) {}

  @Auth([AuthType.Bearer])
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Bootstrap/Map profile từ Supabase Auth (RC-API-005)',
    description:
      'Sau khi user đăng ký/đăng nhập qua Supabase Auth SDK, gọi endpoint này để tạo hoặc lấy profile TrekGo',
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
  async getMe(@ActiveUser() user: ActiveUserData) {
    if (user?.id) {
      return await this.getProfileUseCase.execute(user.id)
    }
    return user
  }

  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Đăng ký tài khoản người dùng mới' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công, trả về user và tokens' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ (Zod Validation)' })
  @ApiResponse({ status: 409, description: 'Email đã tồn tại' })
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

   @Auth([AuthType.Bearer])
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đăng xuất khỏi hệ thống (RC-API-003)' })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  @Post('logout')
  async logout(@Req() req: any) {
    // Lấy Bearer Access Token từ header của request
    const authHeader = req.headers.authorization
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : undefined

    return await this.authLogoutUseCase.execute(accessToken)
  }


  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Yêu cầu đặt lại mật khẩu (Forgot Password)' })
  @ApiResponse({ status: 200, description: 'Đã gửi email khôi phục' })
  @Post('reset-forgot-password')
  async forgotPassword(@Body(new ZodValidationPipe(ForgotPasswordSchema)) body: ForgotPasswordDto) {
    return await this.authForgotPasswordUseCase.execute(body.email)
  }
  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Xác thực mã OTP để kích hoạt tài khoản' })
  @ApiResponse({ status: 200, description: 'Xác thực thành công, đăng nhập vào hệ thống' })
  @Post('verify-otp')
  async verifyOtp(@Body(new ZodValidationPipe(VerifyOtpSchema)) body: VerifyOtpDto) {
    return await this.authVerifyOtpUseCase.execute(body)
  }
  
  @Auth([AuthType.None])
  @ApiOperation({ summary: 'Gửi lại mã OTP xác thực email' })
  @ApiResponse({ status: 200, description: 'Gửi lại mã OTP thành công' })
  @Post('resend-otp')
  async resendOtp(@Body(new ZodValidationPipe(ResendOtpSchema)) body: ResendOtpDto) {
    return await this.authResendOtpUseCase.execute(body.email)
  }
}
