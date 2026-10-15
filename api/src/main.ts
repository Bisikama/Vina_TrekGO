import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import envConfig from './shared/config';
import { GlobalErrorFilter } from './shared/errors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ['warn', 'error', 'fatal'],
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalErrorFilter());

  // Bật CORS cho phép Frontend (http://localhost:5000) gọi API
  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Accept,Authorization,x-api-key',
  });

  // Swagger Documentation Setup
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

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(envConfig.PORT);
}
void bootstrap();
