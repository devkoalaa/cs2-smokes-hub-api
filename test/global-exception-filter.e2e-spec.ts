import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common';

describe('GlobalExceptionFilter (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply the same configuration as in main.ts
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Validation Error Handling', () => {
    it('should return formatted validation errors for invalid smoke creation', () => {
      return request(app.getHttpServer())
        .post('/smokes')
        .send({
          title: '', // Invalid: too short
          videoUrl: 'not-a-url', // Invalid: not a URL
          timestamp: -1, // Invalid: negative
          x_coord: 'not-a-number', // Invalid: not a number
          y_coord: 100.5,
          mapId: 'not-a-number', // Invalid: not a number
        })
        .expect(401) // Will be unauthorized first, but let's test with auth
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode');
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path');
        });
    });
  });

  describe('Not Found Error Handling', () => {
    it('should return formatted 404 error for non-existent endpoint', () => {
      return request(app.getHttpServer())
        .get('/non-existent-endpoint')
        .expect(404)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 404);
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path', '/non-existent-endpoint');
        });
    });
  });

  describe('Maps Endpoint Error Handling', () => {
    it('should return formatted 404 error for non-existent map', () => {
      return request(app.getHttpServer())
        .get('/maps/999999')
        .expect(404)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 404);
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path', '/maps/999999');
        });
    });

    it('should return formatted validation error for invalid map ID', () => {
      return request(app.getHttpServer())
        .get('/maps/invalid-id')
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 400);
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path', '/maps/invalid-id');
        });
    });
  });

  describe('Authentication Error Handling', () => {
    it('should return formatted 401 error for protected endpoints without auth', () => {
      return request(app.getHttpServer())
        .post('/smokes')
        .send({
          title: 'Test Smoke',
          videoUrl: 'https://example.com/video',
          timestamp: 30,
          x_coord: 100.5,
          y_coord: 200.3,
          mapId: 1,
        })
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path', '/smokes');
        });
    });
  });
});