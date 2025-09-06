import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express'; // NOVO: Importar o adapter
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express'; // NOVO: Importar o express
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common';

// NOVO: Criar e exportar a instância do Express que a Vercel usará
export const app = express();

async function bootstrap() {
  // MUDOU: O NestJS agora usa a instância do Express que criamos
  const server = await NestFactory.create(
    AppModule,
    new ExpressAdapter(app),
  );

  // A partir daqui, usamos a variável 'server' em vez de 'app'
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
  SwaggerModule.setup('api-docs', server, document, { // Mudei a rota para 'api-docs' para evitar conflitos
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  // }

  // MUDOU: Usamos init() para inicializar o app sem escutar uma porta
  await server.init();

  // REMOVIDO: A seção app.listen(port) e os console.log foram removidos
}

// A função é chamada para garantir que a configuração seja executada
bootstrap();