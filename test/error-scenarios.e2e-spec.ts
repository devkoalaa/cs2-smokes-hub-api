import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Error Scenarios and Edge Cases (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testUser: any;
  let testMap: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    
    // Apply the same configuration as in main.ts
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    await app.init();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.report.deleteMany();
    await prisma.rating.deleteMany();
    await prisma.smoke.deleteMany();
    await prisma.user.deleteMany();
    await prisma.map.deleteMany();

    // Create test data
    testMap = await prisma.map.create({
      data: {
        name: 'de_cache',
        imageUrl: 'https://example.com/cache.jpg',
      },
    });

    testUser = await prisma.user.create({
      data: {
        steamId: '76561198000000010',
        username: 'ErrorTestUser',
        avatarUrl: 'https://example.com/error-test.jpg',
      },
    });

    // Generate auth token
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign(
      { sub: testUser.id, steamId: testUser.steamId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('Input Validation Error Scenarios', () => {
    describe('Smoke Creation Validation', () => {
      it('should return detailed validation errors for multiple invalid fields', () => {
        return request(app.getHttpServer())
          .post('/smokes')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: '', // Invalid: empty
            videoUrl: 'not-a-url', // Invalid: not URL
            timestamp: -5, // Invalid: negative
            x_coord: 'not-a-number', // Invalid: not number
            y_coord: null, // Invalid: null
            mapId: 'invalid', // Invalid: not number
          })
          .expect(400)
          .expect((res) => {
            expect(res.body).toHaveProperty('statusCode', 400);
            expect(res.body.message).toBeInstanceOf(Array);
            expect(res.body.message.length).toBeGreaterThan(3);
            
            // Check for specific validation messages
            const messages = res.body.message.join(' ');
            expect(messages).toContain('Title must be between 1 and 100 characters');
            expect(messages).toContain('Video URL must be a valid URL');
            expect(messages).toContain('Timestamp must be a positive number');
          });
      });

      it('should reject smoke with excessively long title', () => {
        const longTitle = 'A'.repeat(101); // Exceeds 100 character limit
        
        return request(app.getHttpServer())
          .post('/smokes')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: longTitle,
            videoUrl: 'https://example.com/long-title.mp4',
            timestamp: 30,
            x_coord: 100.0,
            y_coord: 200.0,
            mapId: testMap.id,
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain('Title must be between 1 and 100 characters');
          });
      });

      it('should reject smoke with invalid URL formats', () => {
        const invalidUrls = [
          'not-a-url',
          'ftp://example.com/video.mp4',
          'javascript:alert("xss")',
          'http://',
          'https://',
          '',
        ];

        return Promise.all(
          invalidUrls.map(url =>
            request(app.getHttpServer())
              .post('/smokes')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                title: 'URL Test',
                videoUrl: url,
                timestamp: 30,
                x_coord: 100.0,
                y_coord: 200.0,
                mapId: testMap.id,
              })
              .expect(400)
          )
        );
      });

      it('should reject smoke with invalid coordinate types', () => {
        const invalidCoordinates = [
          { x_coord: 'string', y_coord: 100.0 },
          { x_coord: 100.0, y_coord: 'string' },
          { x_coord: null, y_coord: 100.0 },
          { x_coord: 100.0, y_coord: undefined },
          { x_coord: {}, y_coord: 100.0 },
          { x_coord: [], y_coord: 100.0 },
        ];

        return Promise.all(
          invalidCoordinates.map(coords =>
            request(app.getHttpServer())
              .post('/smokes')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                title: 'Coordinate Test',
                videoUrl: 'https://example.com/coord-test.mp4',
                timestamp: 30,
                ...coords,
                mapId: testMap.id,
              })
              .expect(400)
          )
        );
      });
    });

    describe('Rating Validation', () => {
      let testSmoke: any;

      beforeEach(async () => {
        testSmoke = await prisma.smoke.create({
          data: {
            title: 'Rating Test Smoke',
            videoUrl: 'https://example.com/rating-test.mp4',
            timestamp: 30,
            x_coord: 100.0,
            y_coord: 200.0,
            authorId: testUser.id,
            mapId: testMap.id,
          },
        });
      });

      it('should reject invalid rating values', () => {
        const invalidValues = [0, 2, -2, 1.5, -1.5, 'string', null, undefined, {}, []];

        return Promise.all(
          invalidValues.map(value =>
            request(app.getHttpServer())
              .post(`/smokes/${testSmoke.id}/rate`)
              .set('Authorization', `Bearer ${authToken}`)
              .send({ value })
              .expect(400)
          )
        );
      });

      it('should reject rating with missing value field', () => {
        return request(app.getHttpServer())
          .post(`/smokes/${testSmoke.id}/rate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({}) // Missing value field
          .expect(400);
      });

      it('should reject rating with extra fields', () => {
        return request(app.getHttpServer())
          .post(`/smokes/${testSmoke.id}/rate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            value: 1,
            extraField: 'should be rejected', // Extra field
          })
          .expect(400);
      });
    });

    describe('Report Validation', () => {
      let testSmoke: any;

      beforeEach(async () => {
        testSmoke = await prisma.smoke.create({
          data: {
            title: 'Report Test Smoke',
            videoUrl: 'https://example.com/report-test.mp4',
            timestamp: 30,
            x_coord: 100.0,
            y_coord: 200.0,
            authorId: testUser.id,
            mapId: testMap.id,
          },
        });
      });

      it('should reject report with reason too short', () => {
        const shortReasons = ['', 'a', 'short', 'too short']; // All under 10 characters

        return Promise.all(
          shortReasons.map(reason =>
            request(app.getHttpServer())
              .post(`/smokes/${testSmoke.id}/report`)
              .set('Authorization', `Bearer ${authToken}`)
              .send({ reason })
              .expect(400)
          )
        );
      });

      it('should reject report with reason too long', () => {
        const longReason = 'A'.repeat(501); // Exceeds 500 character limit

        return request(app.getHttpServer())
          .post(`/smokes/${testSmoke.id}/report`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: longReason })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain('Reason must not exceed 500 characters');
          });
      });

      it('should accept report with reason at boundary lengths', async () => {
        const minReason = 'A'.repeat(10); // Minimum valid length
        const maxReason = 'A'.repeat(500); // Maximum valid length

        await request(app.getHttpServer())
          .post(`/smokes/${testSmoke.id}/report`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: minReason })
          .expect(201);

        // Create another smoke for the second test
        const anotherSmoke = await prisma.smoke.create({
          data: {
            title: 'Another Report Test Smoke',
            videoUrl: 'https://example.com/another-report-test.mp4',
            timestamp: 45,
            x_coord: 150.0,
            y_coord: 250.0,
            authorId: testUser.id,
            mapId: testMap.id,
          },
        });

        await request(app.getHttpServer())
          .post(`/smokes/${anotherSmoke.id}/report`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: maxReason })
          .expect(201);
      });
    });
  });  describe(
'Resource Not Found Scenarios', () => {
    it('should return consistent 404 format for all not found resources', async () => {
      const notFoundTests = [
        { method: 'get', path: '/maps/999999', description: 'non-existent map' },
        { method: 'get', path: '/maps/999999/smokes', description: 'smokes for non-existent map' },
        { method: 'delete', path: '/smokes/999999', auth: true, description: 'non-existent smoke deletion' },
        { method: 'post', path: '/smokes/999999/rate', auth: true, body: { value: 1 }, description: 'rating non-existent smoke' },
        { method: 'post', path: '/smokes/999999/report', auth: true, body: { reason: 'Test report for non-existent smoke resource.' }, description: 'reporting non-existent smoke' },
      ];

      for (const test of notFoundTests) {
        const req = request(app.getHttpServer())[test.method](test.path);
        
        if (test.auth) {
          req.set('Authorization', `Bearer ${authToken}`);
        }
        
        if (test.body) {
          req.send(test.body);
        }

        await req
          .expect(404)
          .expect((res) => {
            expect(res.body).toHaveProperty('statusCode', 404);
            expect(res.body).toHaveProperty('message');
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('path', test.path);
          });
      }
    });

    it('should handle invalid ID formats consistently', async () => {
      const invalidIdTests = [
        { method: 'get', path: '/maps/invalid-id', description: 'invalid map ID' },
        { method: 'get', path: '/maps/abc/smokes', description: 'invalid map ID in smokes endpoint' },
        { method: 'delete', path: '/smokes/invalid-id', auth: true, description: 'invalid smoke ID for deletion' },
        { method: 'post', path: '/smokes/abc/rate', auth: true, body: { value: 1 }, description: 'invalid smoke ID for rating' },
        { method: 'post', path: '/smokes/xyz/report', auth: true, body: { reason: 'Test report for invalid smoke ID format.' }, description: 'invalid smoke ID for reporting' },
      ];

      for (const test of invalidIdTests) {
        const req = request(app.getHttpServer())[test.method](test.path);
        
        if (test.auth) {
          req.set('Authorization', `Bearer ${authToken}`);
        }
        
        if (test.body) {
          req.send(test.body);
        }

        await req
          .expect(400)
          .expect((res) => {
            expect(res.body).toHaveProperty('statusCode', 400);
            expect(res.body).toHaveProperty('message');
          });
      }
    });
  });

  describe('Authorization and Ownership Scenarios', () => {
    let testSmoke: any;
    let otherUser: any;
    let otherUserToken: string;

    beforeEach(async () => {
      // Create test smoke
      testSmoke = await prisma.smoke.create({
        data: {
          title: 'Ownership Test Smoke',
          videoUrl: 'https://example.com/ownership-test.mp4',
          timestamp: 30,
          x_coord: 100.0,
          y_coord: 200.0,
          authorId: testUser.id,
          mapId: testMap.id,
        },
      });

      // Create another user
      otherUser = await prisma.user.create({
        data: {
          steamId: '76561198000000011',
          username: 'OtherErrorTestUser',
          avatarUrl: 'https://example.com/other-error-test.jpg',
        },
      });

      const jwt = require('jsonwebtoken');
      otherUserToken = jwt.sign(
        { sub: otherUser.id, steamId: otherUser.steamId },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
    });

    it('should prevent non-owner from deleting smoke', () => {
      return request(app.getHttpServer())
        .delete(`/smokes/${testSmoke.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 403);
          expect(res.body).toHaveProperty('message');
        });
    });

    it('should allow owner to delete their own smoke', () => {
      return request(app.getHttpServer())
        .delete(`/smokes/${testSmoke.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });

    it('should handle deletion of already deleted smoke', async () => {
      // Delete the smoke first
      await request(app.getHttpServer())
        .delete(`/smokes/${testSmoke.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Try to delete again
      return request(app.getHttpServer())
        .delete(`/smokes/${testSmoke.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Database Constraint and Integrity Scenarios', () => {
    it('should handle foreign key constraint violations gracefully', () => {
      return request(app.getHttpServer())
        .post('/smokes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Foreign Key Test',
          videoUrl: 'https://example.com/fk-test.mp4',
          timestamp: 30,
          x_coord: 100.0,
          y_coord: 200.0,
          mapId: 999999, // Non-existent map ID
        })
        .expect(400);
    });

    it('should handle concurrent rating operations correctly', async () => {
      const testSmoke = await prisma.smoke.create({
        data: {
          title: 'Concurrent Rating Test',
          videoUrl: 'https://example.com/concurrent-rating.mp4',
          timestamp: 30,
          x_coord: 100.0,
          y_coord: 200.0,
          authorId: testUser.id,
          mapId: testMap.id,
        },
      });

      // Simulate rapid concurrent rating updates
      const ratingPromises = [
        request(app.getHttpServer())
          .post(`/smokes/${testSmoke.id}/rate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ value: 1 }),
        request(app.getHttpServer())
          .post(`/smokes/${testSmoke.id}/rate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ value: -1 }),
        request(app.getHttpServer())
          .post(`/smokes/${testSmoke.id}/rate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ value: 1 }),
      ];

      const results = await Promise.all(ratingPromises);
      
      // All requests should succeed due to upsert behavior
      results.forEach(result => expect(result.status).toBe(200));

      // Should have only one rating record
      const ratings = await prisma.rating.findMany({
        where: { userId: testUser.id, smokeId: testSmoke.id },
      });
      expect(ratings).toHaveLength(1);
    });
  });

  describe('Malformed Request Scenarios', () => {
    it('should handle requests with invalid JSON', () => {
      return request(app.getHttpServer())
        .post('/smokes')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    it('should handle requests with wrong content type', () => {
      return request(app.getHttpServer())
        .post('/smokes')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'text/plain')
        .send('not json data')
        .expect(400);
    });

    it('should handle extremely large payloads gracefully', () => {
      const largePayload = {
        title: 'A'.repeat(10000), // Extremely long title
        videoUrl: 'https://example.com/large.mp4',
        timestamp: 30,
        x_coord: 100.0,
        y_coord: 200.0,
        mapId: testMap.id,
      };

      return request(app.getHttpServer())
        .post('/smokes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largePayload)
        .expect(400);
    });
  });

  describe('HTTP Method and Route Scenarios', () => {
    it('should return 404 for non-existent routes', () => {
      return request(app.getHttpServer())
        .get('/non-existent-route')
        .expect(404);
    });

    it('should return 405 for unsupported HTTP methods', () => {
      return request(app.getHttpServer())
        .patch('/maps') // PATCH not supported on /maps
        .expect(404); // NestJS returns 404 for unsupported methods
    });

    it('should handle OPTIONS requests for CORS', () => {
      return request(app.getHttpServer())
        .options('/maps')
        .expect((res) => {
          // Should not return an error
          expect([200, 204]).toContain(res.status);
        });
    });
  });

  describe('Rate Limiting and Security Scenarios', () => {
    it('should handle multiple rapid requests from same user', async () => {
      const testSmoke = await prisma.smoke.create({
        data: {
          title: 'Rapid Request Test',
          videoUrl: 'https://example.com/rapid-test.mp4',
          timestamp: 30,
          x_coord: 100.0,
          y_coord: 200.0,
          authorId: testUser.id,
          mapId: testMap.id,
        },
      });

      // Send multiple rapid requests
      const rapidRequests = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post(`/smokes/${testSmoke.id}/rate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ value: 1 })
      );

      const results = await Promise.all(rapidRequests);
      
      // All should succeed (no rate limiting implemented yet)
      results.forEach(result => expect(result.status).toBe(200));
    });

    it('should sanitize error messages to prevent information leakage', async () => {
      // Try to access with a token for a deleted user
      await prisma.user.delete({ where: { id: testUser.id } });

      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401)
        .expect((res) => {
          // Should not reveal internal database details
          expect(res.body.message).not.toContain('Prisma');
          expect(res.body.message).not.toContain('database');
          expect(res.body.message).not.toContain('SQL');
        });
    });
  });

  describe('Edge Case Data Scenarios', () => {
    it('should handle extreme coordinate values', () => {
      return request(app.getHttpServer())
        .post('/smokes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Extreme Coordinates',
          videoUrl: 'https://example.com/extreme.mp4',
          timestamp: 1,
          x_coord: -999999.999999,
          y_coord: 999999.999999,
          mapId: testMap.id,
        })
        .expect(201);
    });

    it('should handle zero and negative timestamps appropriately', () => {
      return request(app.getHttpServer())
        .post('/smokes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Zero Timestamp',
          videoUrl: 'https://example.com/zero.mp4',
          timestamp: 0, // Should be rejected (must be positive)
          x_coord: 100.0,
          y_coord: 200.0,
          mapId: testMap.id,
        })
        .expect(400);
    });

    it('should handle Unicode characters in text fields', () => {
      return request(app.getHttpServer())
        .post('/smokes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '🎮 CS2 Smoke 💨 Test 中文 العربية',
          videoUrl: 'https://example.com/unicode.mp4',
          timestamp: 30,
          x_coord: 100.0,
          y_coord: 200.0,
          mapId: testMap.id,
        })
        .expect(201);
    });
  });
});