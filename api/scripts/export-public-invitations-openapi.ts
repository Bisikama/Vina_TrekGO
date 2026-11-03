import { BookingsController } from '../src/modules/bookings/bookings.controller'
import { BookingsService } from '../src/modules/bookings/bookings.service'
import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { PublicInvitationsController } from '../src/modules/bookings/public-invitations.controller'
import { PublicInvitationsService } from '../src/modules/bookings/public-invitations.service'

// Metadata-only export: no database connection, tokens, workers or business calls.
@Module({
  controllers: [PublicInvitationsController, BookingsController],
  providers: [
    { provide: PublicInvitationsService, useValue: {} },
    { provide: BookingsService, useValue: {} },
  ],
})
class ContractModule {}
async function main() {
  const app = await NestFactory.create(ContractModule, { logger: false })
  try {
    app.setGlobalPrefix('api/v1')
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('TrekGo Public participant invitations')
        .setVersion('1.1.0')
        .setDescription(
          'M6/M7 backend contract. Six invitation operations; buyer linkage and actor-scoped navigation permissions. Rental integration remains M9. Deployment not implied.',
        )
        .addBearerAuth(undefined, 'bearer')
        .build(),
    )
    doc.paths = Object.fromEntries(
      Object.entries(doc.paths).filter(([path]) => path.includes('invitations') || path === '/api/v1/bookings/{id}'),
    )
    const output = resolve('contracts/openapi/public-invitations.json')
    mkdirSync(resolve('contracts/openapi'), { recursive: true })
    writeFileSync(output, JSON.stringify(doc, null, 2) + '\n')
    console.log(output)
  } finally {
    await app.close()
  }
}
main().catch(() => {
  console.error('Public invitation contract export failed')
  process.exitCode = 1
})
