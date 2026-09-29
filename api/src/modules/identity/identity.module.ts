import { Module } from '@nestjs/common'
import { AuthController } from './presentation/controllers/auth.controller'
import { AuthRegisterUseCase } from './application/use-cases/auth-register.use-case'
import { AuthLoginUseCase } from './application/use-cases/auth-login.use-case'
import { AuthBootstrapUseCase } from './application/use-cases/auth-bootstrap.use-case'
import { AuthRefreshUseCase } from './application/use-cases/auth-refresh.use-case'
import { AuthLogoutUseCase } from './application/use-cases/auth-logout.use-case'
import { GetProfileUseCase } from './application/use-cases/get-profile.use-case'
import { I_USER_REPOSITORY } from './application/ports/user.port'
import { PrismaUserAdapter } from './infrastructure/adapters/prisma-user.adapter'
import { I_IDENTITY_PROVIDER } from './application/ports/identity.port'
import { SupabaseIdentityAdapter } from './infrastructure/adapters/supabase-identity.adapter'
import { AuthForgotPasswordUseCase } from './application/use-cases/auth-forgot-password.use-case'
import { AuthVerifyOtpUseCase } from './application/use-cases/auth-verify-otp.use-case'
import { AuthResendOtpUseCase } from './application/use-cases/auth-resend-otp.use-case'

@Module({
  controllers: [AuthController],
  providers: [
    AuthRegisterUseCase,
    AuthLoginUseCase,
    AuthBootstrapUseCase,
    AuthRefreshUseCase,
    AuthLogoutUseCase,
    GetProfileUseCase,
    AuthForgotPasswordUseCase,
    AuthVerifyOtpUseCase,
    AuthResendOtpUseCase,
    {
      provide: I_USER_REPOSITORY,
      useClass: PrismaUserAdapter,
    },
    {
      provide: I_IDENTITY_PROVIDER,
      useClass: SupabaseIdentityAdapter,
    },
  ],
  exports: [GetProfileUseCase, I_USER_REPOSITORY], // Export for other modules if needed
})
export class IdentityModule {}
