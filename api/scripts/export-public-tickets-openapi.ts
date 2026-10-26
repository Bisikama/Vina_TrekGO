import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { TicketsController } from '../src/modules/bookings/tickets.controller'
import { ParticipantClaimService } from '../src/modules/bookings/participant-claim.service'
import { TicketsService } from '../src/modules/bookings/tickets.service'
import { TripNavigationController } from '../src/modules/trips/presentation/controllers/trip-navigation.controller'
import { GetNavigationContextUseCase } from '../src/modules/trips/application/use-cases/get-navigation-context.use-case'
import { SwitchTrailUseCase } from '../src/modules/trips/application/use-cases/switch-trail.use-case'

// Metadata-only export: no database connection, tokens, workers or business calls.
@Module({
  controllers: [TicketsController, TripNavigationController],
  providers: [
    { provide: ParticipantClaimService, useValue: {} },
    { provide: TicketsService, useValue: {} },
    { provide: GetNavigationContextUseCase, useValue: {} },
    { provide: SwitchTrailUseCase, useValue: {} },
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
        .setTitle('TrekGo Public personal tickets')
        .setVersion('1.1.0')
        .setDescription(
          'M5–M7 backend contract. Personal tickets, linked participation history and navigation. Rental integration remains M9. Deployment not implied.',
        )
        .addBearerAuth(undefined, 'bearer')
        .build(),
    )
    const participationPaths = Object.fromEntries(
      Object.entries(doc.paths).filter(
        ([path]) => path.endsWith('/navigation-context') || path.endsWith('/public-trip-participations/history'),
      ),
    )
    const output = resolve('contracts/openapi/public-tickets.json')
    mkdirSync(resolve('contracts/openapi'), { recursive: true })
    writeFileSync(
      resolve('contracts/openapi/public-participation.json'),
      JSON.stringify(
        { ...doc, info: { ...doc.info, title: 'TrekGo Public participation M7' }, paths: participationPaths },
        null,
        2,
      ) + '\n',
    )
    doc.paths = Object.fromEntries(Object.entries(doc.paths).filter(([path]) => !path.startsWith('/api/v1/trips/')))
    writeFileSync(output, JSON.stringify(doc, null, 2) + '\n')
    console.log(output)
  } finally {
    await app.close()
  }
}
main().catch(() => {
  console.error('Public tickets contract export failed')
  process.exitCode = 1
})
