import 'reflect-metadata'
import { Test } from '@nestjs/testing'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { TripGpsController } from '../src/modules/geo/presentation/controllers/trip-gps.controller'
import { TripGpsRecordingService } from '../src/modules/geo/infrastructure/adapters/trip-gps-recording.service'

async function generate() {
  const module = await Test.createTestingModule({
    controllers: [TripGpsController],
    providers: [{ provide: TripGpsRecordingService, useValue: {} }],
  }).compile()
  const app = module.createNestApplication()
  app.setGlobalPrefix('api/v1')
  const config = new DocumentBuilder()
    .setTitle('TrekGo Trip GPS')
    .setVersion('trip-gps/1.0.0')
    .addBearerAuth(undefined, 'bearer')
    .build()
  const document = SwaggerModule.createDocument(app, config)
  const operations = Object.values(document.paths).reduce(
    (n, path) => n + Object.keys(path ?? {}).filter((k) => ['get', 'post'].includes(k)).length,
    0,
  )
  if (operations !== 10) throw new Error(`Expected 10 GPS REST operations; found ${operations}`)
  const folder = join(__dirname, '..', 'contracts', 'openapi')
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, 'trip-gps.json'), JSON.stringify(document, null, 2) + '\n')
  await app.close()
  console.log('Generated contracts/openapi/trip-gps.json (10 operations)')
}
generate().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
