import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { mkdirSync, writeFileSync } from 'fs'
import { InvitationInboxController } from '../src/modules/bookings/invitation-inbox.controller'
import { InvitationInboxService } from '../src/modules/bookings/invitation-inbox.service'
import { NotificationsController } from '../src/modules/notifications/notifications.controller'
import { NotificationsService } from '../src/modules/notifications/notifications.service'
@Module({
  controllers: [InvitationInboxController, NotificationsController],
  providers: [
    { provide: InvitationInboxService, useValue: {} },
    { provide: NotificationsService, useValue: {} },
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
        .setTitle('TrekGo invitation inbox M8')
        .setVersion('1.0.0')
        .setDescription(
          'Local backend contract. Unified recipient inbox and existing notification endpoints. Deployment not implied. Notification response fields are documented in contracts/invitation-inbox/README.md.',
        )
        .addBearerAuth(undefined, 'bearer')
        .build(),
    )
    mkdirSync('contracts/openapi', { recursive: true })
    writeFileSync('contracts/openapi/invitation-inbox.json', JSON.stringify(doc, null, 2) + '\n')
  } finally {
    await app.close()
  }
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
