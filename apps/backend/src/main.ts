import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
  });
  app.enableCors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000')
      .split(',')
      .map((value) => value.trim()),
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Trading Card API')
    .setDescription('Scan, catalog, and import endpoints for the Trading Card app')
    .setVersion('0.1.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
}

void bootstrap();
