import { Global, Module } from '@nestjs/common'
import { PrismaService } from './services/prisma.service'
import { SupabaseService } from './services/supabase.service'
import { AccessTokenGuard } from './guards/access-token.guard'
import { ApiKeyGuard } from './guards/api-key.guard'
import { APP_GUARD } from '@nestjs/core'
import { AuthenticationGuard } from './guards/authentication.guard'

@Global()
@Module({
  providers: [
    PrismaService,
    SupabaseService,
    AccessTokenGuard,
    ApiKeyGuard,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
  ],
  exports: [PrismaService, SupabaseService],
})
export class SharedModule {}

