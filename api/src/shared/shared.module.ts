import { CancellationDeliveryService } from './services/cancellation-delivery.service'
import { Global, Module } from '@nestjs/common'
import { PrismaService } from './services/prisma.service'
import { SupabaseService } from './services/supabase.service'
import { AccessTokenGuard } from './guards/access-token.guard'
import { ApiKeyGuard } from './guards/api-key.guard'
import { APP_GUARD } from '@nestjs/core'
import { AuthenticationGuard } from './guards/authentication.guard'
import { RolesGuard } from './guards/roles.guard'

import { RedisService } from './redis/redis.service'

@Global()
@Module({
  providers: [
    CancellationDeliveryService,
    PrismaService,
    SupabaseService,
    RedisService,
    AccessTokenGuard,
    ApiKeyGuard,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [CancellationDeliveryService, PrismaService, SupabaseService, RedisService],
})
export class SharedModule {}
