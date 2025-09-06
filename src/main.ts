// src/main.ts

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common';

// Variável para armazenar a instância da aplicação em cache
let cachedApp: INestApplication;

// A função bootstrap agora prepara e RETORNA a aplicação
async function bootstrap(): Promise<INestApplication> {
  // Se a aplicação já foi iniciada, retorne a instância em cache
  if (cachedApp) {
    return cachedApp;
  }

  const expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );

  // Mantenha todas as suas configurações aqui
  app.enableCors({
    origin: ['http://localhost:5757', 'http://localhost:3000', 'https://sua-url-de-frontend.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    disableErrorMessages: false,
    validationError: { target: false, value: false },
  }));

  if (process.env.NODE_ENV !== 'staging') {
    const config = new DocumentBuilder()
      .setTitle('CS2 Smokes Hub API')
      .setDescription('RESTful API for sharing and rating Counter-Strike 2 smoke grenade strategies')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'JWT', description: 'Enter JWT token', in: 'header' }, 'JWT-auth')
      .addTag('auth').addTag('maps').addTag('smokes').addTag('ratings').addTag('reports')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document, { swaggerOptions: { persistAuthorization: true } });
  }

  await app.init();
  cachedApp = app; // Armazene a instância no cache
  return app;
}

// O EXPORT DEFAULT é uma função assíncrona que a Vercel irá chamar
export default async (req: any, res: any) => {
  const app = await bootstrap();
  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance(req, res);
};