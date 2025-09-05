import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('Authentication Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);
    
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('Steam Authentication Flow', () => {
    it('should redirect to Steam authentication page', () => {
      return request(app.getHttpServer())
        .get('/auth/steam')
        .expect(302)
        .expect((res) => {
          // Should redirect to Steam OpenID URL
          expect(res.headers.location).toContain('steamcommunity.com');
        });
    });

    it('should handle Steam callback with missing user data', () => {
      return request(app.getHttpServer())
        .get('/auth/steam/return')
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body.message).toContain('Authentication failed');
        });
    });

    describe('User Creation and JWT Generation', () => {
      const mockSteamProfile = {
        id: '76561198000000001',
        displayName: 'TestSteamUser',
        photos: [{ value: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/test.jpg' }],
      };

      it('should create new user from Steam profile', async () => {
        const user = await authService.validateSteamUser(mockSteamProfile);
        
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('steamId', mockSteamProfile.id);
        expect(user).toHaveProperty('username', mockSteamProfile.displayName);
        expect(user).toHaveProperty('avatarUrl', mockSteamProfile.photos[0].value);

        // Verify user was created in database
        const dbUser = await prisma.user.findUnique({
          where: { steamId: mockSteamProfile.id },
        });
        expect(dbUser).toBeTruthy();
        expect(dbUser.steamId).toBe(mockSteamProfile.id);
      });

      it('should update existing user from Steam profile', async () => {
        // Create initial user
        const initialUser = await prisma.user.create({
          data: {
            steamId: mockSteamProfile.id,
            username: 'OldUsername',
            avatarUrl: 'https://old-avatar.com/old.jpg',
          },
        });

        // Validate with updated profile
        const updatedUser = await authService.validateSteamUser(mockSteamProfile);
        
        expect(updatedUser.id).toBe(initialUser.id);
        expect(updatedUser.username).toBe(mockSteamProfile.displayName);
        expect(updatedUser.avatarUrl).toBe(mockSteamProfile.photos[0].value);

        // Verify database was updated
        const dbUser = await prisma.user.findUnique({
          where: { id: initialUser.id },
        });
        expect(dbUser.username).toBe(mockSteamProfile.displayName);
        expect(dbUser.avatarUrl).toBe(mockSteamProfile.photos[0].value);
      });

      it('should generate valid JWT token', async () => {
        const user = await authService.validateSteamUser(mockSteamProfile);
        const token = await authService.generateJwtToken(user);
        
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // JWT has 3 parts

        // Verify token can be used for authentication
        const response = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('id', user.id);
        expect(response.body).toHaveProperty('steamId', user.steamId);
      });
    });

    describe('JWT Token Validation', () => {
      let testUser: any;
      let validToken: string;

      beforeEach(async () => {
        testUser = await prisma.user.create({
          data: {
            steamId: '76561198000000002',
            username: 'JWTTestUser',
            avatarUrl: 'https://example.com/jwt-test.jpg',
          },
        });

        validToken = await authService.generateJwtToken(testUser);
      });

      it('should validate correct JWT token', () => {
        return request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('id', testUser.id);
            expect(res.body).toHaveProperty('steamId', testUser.steamId);
            expect(res.body).toHaveProperty('username', testUser.username);
            expect(res.body).toHaveProperty('avatarUrl', testUser.avatarUrl);
            expect(res.body).toHaveProperty('createdAt');
            expect(res.body).toHaveProperty('updatedAt');
          });
      });

      it('should reject request without Authorization header', () => {
        return request(app.getHttpServer())
          .get('/auth/me')
          .expect(401);
      });

      it('should reject request with malformed Authorization header', () => {
        return request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', 'InvalidFormat')
          .expect(401);
      });

      it('should reject request with invalid JWT token', () => {
        return request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', 'Bearer invalid.jwt.token')
          .expect(401);
      });

      it('should reject request with expired JWT token', async () => {
        const jwt = require('jsonwebtoken');
        const expiredToken = jwt.sign(
          { sub: testUser.id, steamId: testUser.steamId },
          process.env.JWT_SECRET || 'test-secret',
          { expiresIn: '-1h' } // Expired 1 hour ago
        );

        return request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);
      });

      it('should reject token with invalid signature', () => {
        const jwt = require('jsonwebtoken');
        const invalidToken = jwt.sign(
          { sub: testUser.id, steamId: testUser.steamId },
          'wrong-secret',
          { expiresIn: '1h' }
        );

        return request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${invalidToken}`)
          .expect(401);
      });

      it('should reject token for non-existent user', async () => {
        const jwt = require('jsonwebtoken');
        const nonExistentUserToken = jwt.sign(
          { sub: 999999, steamId: '76561198999999999' },
          process.env.JWT_SECRET || 'test-secret',
          { expiresIn: '1h' }
        );

        return request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${nonExistentUserToken}`)
          .expect(401);
      });
    });

    describe('Protected Endpoint Access Patterns', () => {
      let testUser: any;
      let authToken: string;
      let testMap: any;

      beforeEach(async () => {
        testUser = await prisma.user.create({
          data: {
            steamId: '76561198000000003',
            username: 'ProtectedTestUser',
            avatarUrl: 'https://example.com/protected-test.jpg',
          },
        });

        testMap = await prisma.map.create({
          data: {
            name: 'de_inferno',
            imageUrl: 'https://example.com/inferno.jpg',
          },
        });

        authToken = await authService.generateJwtToken(testUser);
      });

      it('should allow access to all protected endpoints with valid token', async () => {
        // Test smoke creation
        const smokeResponse = await request(app.getHttpServer())
          .post('/smokes')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Protected Test Smoke',
            videoUrl: 'https://example.com/protected.mp4',
            timestamp: 30,
            x_coord: 100.0,
            y_coord: 200.0,
            mapId: testMap.id,
          })
          .expect(201);

        const smokeId = smokeResponse.body.id;

        // Test rating
        await request(app.getHttpServer())
          .post(`/smokes/${smokeId}/rate`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ value: 1 })
          .expect(200);

        // Test reporting
        await request(app.getHttpServer())
          .post(`/smokes/${smokeId}/report`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: 'Testing protected endpoint access with valid authentication token.' })
          .expect(201);

        // Test deletion
        await request(app.getHttpServer())
          .delete(`/smokes/${smokeId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(204);
      });

      it('should deny access to all protected endpoints without token', async () => {
        const protectedEndpoints = [
          { method: 'get', path: '/auth/me' },
          { method: 'post', path: '/smokes', body: { title: 'Test', videoUrl: 'https://example.com', timestamp: 30, x_coord: 100, y_coord: 200, mapId: testMap.id } },
          { method: 'delete', path: '/smokes/1' },
          { method: 'post', path: '/smokes/1/rate', body: { value: 1 } },
          { method: 'post', path: '/smokes/1/report', body: { reason: 'Test report reason for unauthorized access test.' } },
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
  });
});