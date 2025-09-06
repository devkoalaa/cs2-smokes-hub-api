const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const express = require('express');
const { AppModule } = require('../dist/src/app.module');

let app;

async function bootstrap() {
  if (app) {
    return app;
  }

  const expressInstance = express();
  const nestApp = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
  );

  // Enable CORS
  nestApp.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await nestApp.init();
  app = expressInstance;
  return app;
}

module.exports = async (req, res) => {
  const server = await bootstrap();
  server(req, res);
};
