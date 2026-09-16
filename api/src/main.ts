import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import envConfig from './shared/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
  console.log(`Application is running on: http://localhost:${envConfig.PORT}`);
  console.log(`Swagger UI is available at: http://localhost:${envConfig.PORT}/docs`);
}
void bootstrap();
