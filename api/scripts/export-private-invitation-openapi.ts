import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { PrivateMemberInvitationController } from '../src/modules/trips/presentation/controllers/private-member-invitation.controller'
import { PrivateMemberInvitationService } from '../src/modules/trips/infrastructure/adapters/private-member-invitation.service'

// Metadata-only export: no database connection, tokens, workers or business calls.
@Module({ controllers: [PrivateMemberInvitationController], providers: [{ provide: PrivateMemberInvitationService, useValue: {} }] })
class ContractModule {}
async function main() {
  const app = await NestFactory.create(ContractModule, { logger: false })
  try {
    app.setGlobalPrefix('api/v1')
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('TrekGo Private member invitations')
      .setVersion('1.0.0').setDescription('M4 backend contract. Seven direct invitation operations. Deployment not implied. Room remains in CF04 contract.')
      .addBearerAuth(undefined, 'bearer').build())
    const output = resolve('contracts/openapi/private-member-invitations.json')
    mkdirSync(resolve('contracts/openapi'), { recursive: true })
    writeFileSync(output, JSON.stringify(doc, null, 2) + '\n')
    console.log(output)
  } finally { await app.close() }
}
main().catch(() => { console.error('Private invitation contract export failed'); process.exitCode = 1 })
