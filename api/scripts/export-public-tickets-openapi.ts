import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { TicketsController } from '../src/modules/bookings/tickets.controller'
import { ParticipantClaimService } from '../src/modules/bookings/participant-claim.service'
import { TicketsService } from '../src/modules/bookings/tickets.service'

// Metadata-only export: no database connection, tokens, workers or business calls.
@Module({
  controllers: [TicketsController],
  providers: [
    { provide: ParticipantClaimService, useValue: {} },
    { provide: TicketsService, useValue: {} },
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
        .setVersion('1.0.0')
        .setDescription(
          'M5 backend contract. Self-claim and personal tickets. Operational gates M7/M9 remain pending. Deployment not implied.',
        )
        .addBearerAuth(undefined, 'bearer')
        .build(),
    )
    const output = resolve('contracts/openapi/public-tickets.json')
    mkdirSync(resolve('contracts/openapi'), { recursive: true })
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
