import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Trekking API')
    .setDescription('Tài liệu API cho hệ thống Trekking Tour & E-Commerce')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Nhập access token',
        in: 'header',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'Nhập secret API key cho internal endpoints',
      },
      'x-api-key',
    )
    .build();

  let document = SwaggerModule.createDocument(app, config);
  const sf01 = process.argv.includes('--sf01');
  const bookingPolicies = process.argv.includes('--booking-policies');
  if (sf01) {
    const selected = new Set([
      '/api/v1/leader-applications', '/api/v1/leader-applications/me', '/api/v1/leader-certificate-types',
      '/api/v1/admin/leader-applications', '/api/v1/admin/leader-applications/{id}',
      '/api/v1/admin/leader-applications/{id}/review', '/api/v1/media/upload-intents',
      '/api/v1/media/{id}/complete', '/api/v1/media/{id}/delivery',
    ]);
    const paths = Object.fromEntries(Object.entries(document.paths).filter(([route]) => selected.has(route)));
    if (Object.keys(paths).length !== selected.size) throw new Error('Missing SF01/media routes');
    const needed = new Set<string>();
    const collect = (value: unknown) => {
      for (const match of JSON.stringify(value).matchAll(/#\/components\/schemas\/([^"\s]+)/g)) needed.add(match[1]);
    };
    collect(paths);
    const schemas: NonNullable<NonNullable<typeof document.components>['schemas']> = {};
    for (const name of needed) {
      const entry = document.components?.schemas?.[name];
      if (!entry) throw new Error(`Missing OpenAPI schema ${name}`);
      schemas[name] = entry;
      collect(entry);
    }
    document = {
      openapi: document.openapi,
      info: { title: 'TrekGo SF01 Leader Applications', version: '1.0.0', description: 'Backend-only SF01 MVP and shared private certificate media dependencies.' },
      paths,
      components: { schemas, securitySchemes: { bearer: document.components!.securitySchemes!.bearer } },
    };
  }
  
  const isDev = process.env.NODE_ENV === 'development';
  if (bookingPolicies) {
    document = { openapi: document.openapi, info: { title: 'TrekGo Admin Booking Policies', version: '1.0.0' },
      paths: Object.fromEntries(Object.entries(document.paths).filter(([route]) => route.startsWith('/api/v1/admin/booking-policies'))),
      components: { securitySchemes: { bearer: document.components!.securitySchemes!.bearer } } };
    if (Object.keys(document.paths).length !== 3) throw new Error('Missing booking policy CRUD/publish routes');
  }
  const filename = bookingPolicies ? 'booking-policies.json' : sf01 ? 'sf01.json' : isDev ? 'openapi.dev.json' : 'openapi.json';
  const outputPath = path.join(__dirname, '..', 'contracts', 'openapi', filename);
  
  // Ensure directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI spec generated at ${outputPath}`);
  await app.close();
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
