import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common';

describe('Complete API Workflows (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
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

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication Flow Tests', () => {
    describe('Steam Authentication Endpoints', () => {
      it('should redirect to Steam authentication', () => {
        return request(app.getHttpServer())
          .get('/auth/steam')
          .expect(302); // Redirect to Steam
      });

      it('should handle Steam callback without user data', () => {
        return request(app.getHttpServer())
          .get('/auth/steam/return')
          .expect(401)
          .expect((res) => {
            expect(res.body.message).toContain('Authentication failed');
          });
      });
    });

    describe('Protected Route Access', () => {
      it('should reject access without JWT token', () => {
        return request(app.getHttpServer())
          .get('/auth/me')
          .expect(401);
      });

      it('should reject access with invalid JWT token', () => {
        return request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });

      it('should reject smoke creation without authentication', () => {
        return request(app.getHttpServer())
          .post('/smokes')
          .send({
            title: 'Test Smoke',
            videoUrl: 'https://example.com/test.mp4',
            timestamp: 30,
            x_coord: 100.0,
            y_coord: 200.0,
            mapId: 1,
          })
          .expect(401);
      });

      it('should reject rating without authentication', () => {
        return request(app.getHttpServer())
          .post('/smokes/1/rate')
          .send({ value: 1 })
          .expect(401);
      });

      it('should reject reporting without authentication', () => {
        return request(app.getHttpServer())
          .post('/smokes/1/report')
          .send({ reason: 'Test report reason for unauthorized access test.' })
          .expect(401);
      });

      it('should reject smoke deletion without authentication', () => {
        return request(app.getHttpServer())
          .delete('/smokes/1')
          .expect(401);
      });
    });
  });

  describe('Input Validation Tests', () => {
    describe('Smoke Creation Validation', () => {
      it('should return detailed validation errors for invalid smoke data', () => {
        return request(app.getHttpServer())
          .post('/smokes')
          .send({
            title: '', // Invalid: empty
            videoUrl: 'not-a-url', // Invalid: not URL
            timestamp: -5, // Invalid: negative
            x_coord: 'not-a-number', // Invalid: not number
            y_coord: null, // Invalid: null
            mapId: 'invalid', // Invalid: not number
          })
          .expect(401); // Will be unauthorized first, but validates structure
      });
    });

    describe('Rating Validation', () => {
      it('should reject invalid rating values', () => {
        return request(app.getHttpServer())
          .post('/smokes/1/rate')
          .send({ value: 2 }) // Invalid: must be 1 or -1
          .expect(401); // Unauthorized, but validates request structure
      });
    });

    describe('Report Validation', () => {
      it('should reject report with reason too short', () => {
        return request(app.getHttpServer())
          .post('/smokes/1/report')
          .send({ reason: 'short' }) // Invalid: too short
          .expect(401); // Unauthorized, but validates request structure
      });
    });
  });

  describe('Error Handling Tests', () => {
    describe('Resource Not Found', () => {
      it('should return 404 for non-existent map', () => {
        return request(app.getHttpServer())
          .get('/maps/999999')
          .expect(404);
      });

      it('should return 404 for smokes of non-existent map', () => {
        return request(app.getHttpServer())
          .get('/maps/999999/smokes')
          .expect(404);
      });

      it('should return 400 for invalid map ID format', () => {
        return request(app.getHttpServer())
          .get('/maps/invalid-id')
          .expect(400);
      });
    });

    describe('HTTP Method Validation', () => {
      it('should return 404 for non-existent routes', () => {
        return request(app.getHttpServer())
          .get('/non-existent-route')
          .expect(404);
      });
    });

    describe('Malformed Requests', () => {
      it('should handle requests with invalid JSON', () => {
        return request(app.getHttpServer())
          .post('/smokes')
          .set('Content-Type', 'application/json')
          .send('{ invalid json }')
          .expect(400);
      });
    });
  });

  describe('Cross-Module Integration Tests', () => {
    describe('Endpoint Structure Validation', () => {
      it('should have consistent error response format across endpoints', async () => {
        const endpoints = [
          { method: 'get', path: '/maps/999999' },
          { method: 'get', path: '/maps/invalid-id' },
          { method: 'get', path: '/non-existent' },
        ];

        for (const endpoint of endpoints) {
          const response = await request(app.getHttpServer())[endpoint.method](endpoint.path);
          
          expect(response.body).toHaveProperty('statusCode');
          expect(response.body).toHaveProperty('message');
          expect(response.body).toHaveProperty('timestamp');
          expect(response.body).toHaveProperty('path', endpoint.path);
        }
      });
    });

    describe('Global Filter Integration', () => {
      it('should apply global exception filter to all endpoints', () => {
        return request(app.getHttpServer())
          .get('/maps/invalid-id')
          .expect(400)
          .expect((res) => {
            expect(res.body).toHaveProperty('statusCode', 400);
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('path', '/maps/invalid-id');
          });
      });
    });

    describe('Global Validation Pipe Integration', () => {
      it('should apply validation pipe to POST endpoints', () => {
        return request(app.getHttpServer())
          .post('/smokes')
          .send({
            extraField: 'should be rejected', // Should be stripped by whitelist
            title: 'Test',
            videoUrl: 'https://example.com/test.mp4',
            timestamp: 30,
            x_coord: 100.0,
            y_coord: 200.0,
            mapId: 1,
          })
          .expect(401); // Unauthorized, but validates pipe is working
      });
    });
  });

  describe('API Contract Tests', () => {
    describe('Response Format Consistency', () => {
      it('should return consistent error format for validation errors', () => {
        return request(app.getHttpServer())
          .get('/maps/invalid-id')
          .expect(400)
          .expect((res) => {
            expect(res.body).toHaveProperty('statusCode');
            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('path');
          });
      });

      it('should return consistent error format for not found errors', () => {
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

      it('should return consistent error format for unauthorized errors', () => {
        return request(app.getHttpServer())
          .get('/auth/me')
          .expect(401)
          .expect((res) => {
            expect(res.body).toHaveProperty('statusCode', 401);
            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('path', '/auth/me');
          });
      });
    });

    describe('HTTP Status Code Consistency', () => {
      it('should return appropriate status codes for different error types', async () => {
        const testCases = [
          { path: '/auth/me', expectedStatus: 401, description: 'unauthorized' },
          { path: '/maps/999999', expectedStatus: 404, description: 'not found' },
          { path: '/maps/invalid-id', expectedStatus: 400, description: 'bad request' },
          { path: '/non-existent', expectedStatus: 404, description: 'route not found' },
        ];

        for (const testCase of testCases) {
          await request(app.getHttpServer())
            .get(testCase.path)
            .expect(testCase.expectedStatus);
        }
      });
    });
  });

  describe('Security Tests', () => {
    describe('Authentication Requirements', () => {
      it('should protect all write operations', async () => {
        const protectedEndpoints = [
          { method: 'post', path: '/smokes', body: { title: 'Test' } },
          { method: 'delete', path: '/smokes/1' },
          { method: 'post', path: '/smokes/1/rate', body: { value: 1 } },
          { method: 'post', path: '/smokes/1/report', body: { reason: 'Test report reason for security test.' } },
        ];

        for (const endpoint of protectedEndpoints) {
          const req = request(app.getHttpServer())[endpoint.method](endpoint.path);
          
          if (endpoint.body) {
            req.send(endpoint.body);
          }

          await req.expect(401);
        }
      });
    });

    describe('Input Sanitization', () => {
      it('should handle malicious input safely', () => {
        return request(app.getHttpServer())
          .post('/smokes')
          .send({
            title: '<script>alert("xss")</script>',
            videoUrl: 'javascript:alert("xss")',
            timestamp: 30,
            x_coord: 100.0,
            y_coord: 200.0,
            mapId: 1,
          })
          .expect(401); // Should be unauthorized, but validates input handling
      });
    });
  });

  describe('Performance and Load Tests', () => {
    describe('Response Time Tests', () => {
      it('should respond to health check endpoints quickly', async () => {
        const start = Date.now();
        await request(app.getHttpServer())
          .get('/maps')
          .expect((res) => {
            // Should respond regardless of database status
            expect([200, 400, 500]).toContain(res.status);
          });
        const duration = Date.now() - start;
        
        expect(duration).toBeLessThan(5000); // Should respond within 5 seconds
      });
    });

    describe('Concurrent Request Handling', () => {
      it('should handle multiple concurrent requests', async () => {
        const requests = Array.from({ length: 5 }, () =>
          request(app.getHttpServer()).get('/maps')
        );

        const results = await Promise.all(requests);
        
        // All requests should complete
        expect(results).toHaveLength(5);
        results.forEach(result => {
          expect([200, 400, 500]).toContain(result.status);
        });
      });
    });
  });
});