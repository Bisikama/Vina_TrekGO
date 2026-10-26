import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { writeFileSync } from 'fs'
import { LeaderCheckinController } from '../src/modules/bookings/leader-checkin.controller'
import { LeaderCheckinService } from '../src/modules/bookings/leader-checkin.service'
@Module({ controllers: [LeaderCheckinController], providers: [{ provide: LeaderCheckinService, useValue: {} }] })
class ContractModule {}
async function main() {
  const app = await NestFactory.create(ContractModule, { logger: false })
  try {
    app.setGlobalPrefix('api/v1')
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('TrekGo Booking Check-in M9')
        .setVersion('1.0.0')
        .setDescription(
          'Local Booking/Check-in contract. Rental integration remains with Rental owner. No deployment implied.',
        )
        .addBearerAuth(undefined, 'bearer')
        .build(),
    )
    writeFileSync('contracts/openapi/booking-checkin-m9.json', JSON.stringify(doc, null, 2) + '\n')
  } finally {
    await app.close()
  }
}
main().catch((e) => {
  console.error(e.message)
  process.exitCode = 1
})
