import { Global, Module } from '@nestjs/common'
import { PrismaService } from './services/prisma.service'
import { HashingService } from './services/hashing.service';
import { TokenService } from './services/token.service';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenGuard } from './guards/access-token.guard';
import { ApiKeyGuard } from './guards/api-key.guard';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationGuard } from './guards/authentication.guard';
@Global()
@Module({
  providers: [PrismaService, HashingService, TokenService, AccessTokenGuard, ApiKeyGuard, {
    provide: APP_GUARD,
    useClass: AuthenticationGuard
  }],
  exports: [PrismaService, HashingService, TokenService],
  imports: [JwtModule],
})
export class SharedModule { }
