import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS configuration for frontend integration
  app.enableCors({
    origin: ['http://localhost:5757', 'http://localhost:3000'], // Frontend ports
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  
  // Global exception filter for consistent error handling
  app.useGlobalFilters(new GlobalExceptionFilter());
  
  // Global validation pipe with comprehensive configuration
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    disableErrorMessages: false,
    validationError: {
      target: false,
      value: false,
    },
  }));
  
  // Swagger/OpenAPI documentation setup
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
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  
  const port = process.env.PORT || 6969;
  await app.listen(port);
  
  console.log(`🚀 CS2 Smokes Hub API is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation available at: http://localhost:${port}/api`);
}
bootstrap();