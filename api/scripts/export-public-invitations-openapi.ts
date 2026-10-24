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
  controllers: [PublicInvitationsController],
  providers: [
    { provide: PublicInvitationsService, useValue: {} },
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
        .setVersion('1.0.0')
        .setDescription(
          'M6 backend contract. Six invitation operations; buyer linkage projection documented separately. Operational gates M7/M9 remain pending. Deployment not implied.',
        )
        .addBearerAuth(undefined, 'bearer')
        .build(),
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
  console.error('Public tickets contract export failed')
  process.exitCode = 1
})
