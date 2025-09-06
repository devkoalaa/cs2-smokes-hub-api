import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express'; // NOVO: Importar o adapter
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common';
import express = require('express');

export const app = express();

async function bootstrap() {
  const server = await NestFactory.create(
    AppModule,
    new ExpressAdapter(app),
  );

  server.enableCors({
    origin: ['http://localhost:5757', 'http://localhost:3000', 'https://cs2smokeshub.vercel.app'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  server.useGlobalFilters(new GlobalExceptionFilter());

  server.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    disableErrorMessages: false,
    validationError: {
      target: false,
      value: false,
    },
  }));

  // if (process.env.NODE_ENV !== 'production') {
  const config = new DocumentBuilder()
    .setTitle('CS2 Smokes Hub API')
    .setDescription('RESTful API for sharing and rating Counter-Strike 2 smoke grenade strategies')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('maps', 'Map management endpoints')
    .addTag('smokes', 'Smoke strategy endpoints')
    .addTag('ratings', 'Rating system endpoints')
    .addTag('reports', 'Content moderation endpoints')
    .build();

  const document = SwaggerModule.createDocument(server, config);
  SwaggerModule.setup('api-docs', server, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  // }

  await server.init();
}

bootstrap();