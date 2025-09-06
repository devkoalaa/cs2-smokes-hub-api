import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common';
import express from 'express'; 

let cachedApp: INestApplication;

async function bootstrap(): Promise<INestApplication> {
  if (cachedApp) {
    return cachedApp;
  }

  const expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );

  app.enableCors({
    origin: true,
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

  const config = new DocumentBuilder()
    .setTitle('CS2 Smokes Hub API')
    .setDescription('RESTful API for sharing and rating Counter-Strike 2 smoke grenade strategies')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', name: 'JWT', description: 'Enter JWT token', in: 'header' }, 'JWT-auth')
    .addTag('auth').addTag('maps').addTag('smokes').addTag('ratings').addTag('reports')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/', app, document, { swaggerOptions: { persistAuthorization: true } });

  await app.init();
  cachedApp = app;
  return app;
}

if (require.main === module) {
  bootstrap().then(async (app) => {
    const port = process.env.PORT || 6969;
    await app.listen(port);
    console.log(`🚀 Application is running on: http://localhost:${port}`);
    console.log(`📖 Swagger is available at: http://localhost:${port}/api-docs`);
  }).catch(error => {
    console.error('Error starting application:', error);
    process.exit(1);
  });
}

export default async (req: any, res: any) => {
  const app = await bootstrap();
  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance(req, res);
};
