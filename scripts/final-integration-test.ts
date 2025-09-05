#!/usr/bin/env ts-node

/**
 * CS2 Smokes Hub API - Final Integration Test
 * 
 * This script performs a comprehensive integration test of the entire application
 * to verify all components work together correctly.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import * as request from 'supertest';

interface TestUser {
  id: number;
  steamId: string;
  username: string;
  token: string;
}

interface TestMap {
  id: number;
  name: string;
  imageUrl: string;
}

interface TestSmoke {
  id: number;
  title: string;
  videoUrl: string;
  timestamp: number;
  x_coord: number;
  y_coord: number;
  authorId: number;
  mapId: number;
}

class FinalIntegrationTest {
  private app: INestApplication;
  private prisma: PrismaService;
  private jwtService: JwtService;
  private testUser: TestUser;
  private testMap: TestMap;
  private testSmoke: TestSmoke;

  /**
   * Run complete integration test suite
   */
  async run(): Promise<void> {
    console.log('🚀 CS2 Smokes Hub API - Final Integration Test\n');
    console.log('=' .repeat(60));

    try {
      await this.setup();
      await this.runTests();
      console.log('\n🎉 ALL INTEGRATION TESTS PASSED!');
      console.log('The application is fully functional and ready for deployment.');
    } catch (error) {
      console.error('\n❌ INTEGRATION TEST FAILED:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Set up test environment
   */
  private async setup(): Promise<void> {
    console.log('🔧 Setting up test environment...');

    // Create testing module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    
    // Configure application
    this.app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    
    this.app.useGlobalFilters(new GlobalExceptionFilter());

    await this.app.init();

    // Get services
    this.prisma = this.app.get<PrismaService>(PrismaService);
    this.jwtService = this.app.get<JwtService>(JwtService);

    // Create test data
    await this.createTestData();
    
    console.log('✅ Test environment ready');
  }

  /**
   * Create test data
   */
  private async createTestData(): Promise<void> {
    // Create test user
    const user = await this.prisma.user.create({
      data: {
        steamId: '76561198000000000',
        username: 'TestUser',
        avatarUrl: 'https://example.com/avatar.jpg'
      }
    });

    // Generate JWT token
    const token = this.jwtService.sign({ 
      sub: user.id, 
      steamId: user.steamId,
      username: user.username 
    });

    this.testUser = {
      id: user.id,
      steamId: user.steamId,
      username: user.username,
      token
    };

    // Create test map
    const map = await this.prisma.map.create({
      data: {
        name: 'de_dust2',
        imageUrl: 'https://example.com/dust2.jpg'
      }
    });

    this.testMap = {
      id: map.id,
      name: map.name,
      imageUrl: map.imageUrl
    };

    console.log('✅ Test data created');
  }

  /**
   * Run all integration tests
   */
  private async runTests(): Promise<void> {
    console.log('\n🧪 Running integration tests...\n');

    await this.testAuthenticationFlow();
    await this.testMapsEndpoints();
    await this.testSmokeWorkflow();
    await this.testRatingWorkflow();
    await this.testReportingWorkflow();
    await this.testErrorScenarios();
    await this.testSecurityScenarios();
  }

  /**
   * Test authentication flow
   */
  private async testAuthenticationFlow(): Promise<void> {
    console.log('🔐 Testing authentication flow...');

    // Test /auth/me endpoint
    const response = await request(this.app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${this.testUser.token}`)
      .expect(200);

    if (response.body.id !== this.testUser.id) {
      throw new Error('Authentication flow failed');
    }

    // Test unauthorized access
    await request(this.app.getHttpServer())
      .get('/auth/me')
      .expect(401);

    console.log('✅ Authentication flow working');
  }

  /**
   * Test maps endpoints
   */
  private async testMapsEndpoints(): Promise<void> {
    console.log('🗺️  Testing maps endpoints...');

    // Test GET /maps
    const mapsResponse = await request(this.app.getHttpServer())
      .get('/maps')
      .expect(200);

    if (!Array.isArray(mapsResponse.body) || mapsResponse.body.length === 0) {
      throw new Error('Maps endpoint failed');
    }

    // Test GET /maps/:id
    const mapResponse = await request(this.app.getHttpServer())
      .get(`/maps/${this.testMap.id}`)
      .expect(200);

    if (mapResponse.body.id !== this.testMap.id) {
      throw new Error('Map detail endpoint failed');
    }

    // Test 404 for non-existent map
    await request(this.app.getHttpServer())
      .get('/maps/99999')
      .expect(404);

    console.log('✅ Maps endpoints working');
  }

  /**
   * Test complete smoke workflow
   */
  private async testSmokeWorkflow(): Promise<void> {
    console.log('💨 Testing smoke workflow...');

    // Create smoke
    const createResponse = await request(this.app.getHttpServer())
      .post('/smokes')
      .set('Authorization', `Bearer ${this.testUser.token}`)
      .send({
        title: 'Test Smoke Strategy',
        videoUrl: 'https://youtube.com/watch?v=test',
        timestamp: 30,
        x_coord: 100.5,
        y_coord: 200.7,
        mapId: this.testMap.id
      })
      .expect(201);

    this.testSmoke = createResponse.body;

    // Get smokes for map
    const smokesResponse = await request(this.app.getHttpServer())
      .get(`/maps/${this.testMap.id}/smokes`)
      .expect(200);

    if (!Array.isArray(smokesResponse.body) || smokesResponse.body.length === 0) {
      throw new Error('Smoke listing failed');
    }

    const smoke = smokesResponse.body.find(s => s.id === this.testSmoke.id);
    if (!smoke || smoke.score !== 0) {
      throw new Error('Smoke data incorrect');
    }

    // Test unauthorized smoke creation
    await request(this.app.getHttpServer())
      .post('/smokes')
      .send({
        title: 'Unauthorized Smoke',
        videoUrl: 'https://youtube.com/watch?v=test',
        timestamp: 30,
        x_coord: 100.5,
        y_coord: 200.7,
        mapId: this.testMap.id
      })
      .expect(401);

    console.log('✅ Smoke workflow working');
  }

  /**
   * Test rating workflow
   */
  private async testRatingWorkflow(): Promise<void> {
    console.log('⭐ Testing rating workflow...');

    // Rate smoke positively
    await request(this.app.getHttpServer())
      .post(`/smokes/${this.testSmoke.id}/rate`)
      .set('Authorization', `Bearer ${this.testUser.token}`)
      .send({ value: 1 })
      .expect(200);

    // Verify rating updated
    const smokesResponse = await request(this.app.getHttpServer())
      .get(`/maps/${this.testMap.id}/smokes`)
      .expect(200);

    const ratedSmoke = smokesResponse.body.find(s => s.id === this.testSmoke.id);
    if (ratedSmoke.score !== 1) {
      throw new Error('Rating not applied correctly');
    }

    // Change rating to negative
    await request(this.app.getHttpServer())
      .post(`/smokes/${this.testSmoke.id}/rate`)
      .set('Authorization', `Bearer ${this.testUser.token}`)
      .send({ value: -1 })
      .expect(200);

    // Verify rating changed
    const updatedResponse = await request(this.app.getHttpServer())
      .get(`/maps/${this.testMap.id}/smokes`)
      .expect(200);

    const updatedSmoke = updatedResponse.body.find(s => s.id === this.testSmoke.id);
    if (updatedSmoke.score !== -1) {
      throw new Error('Rating update failed');
    }

    // Test invalid rating value
    await request(this.app.getHttpServer())
      .post(`/smokes/${this.testSmoke.id}/rate`)
      .set('Authorization', `Bearer ${this.testUser.token}`)
      .send({ value: 5 })
      .expect(400);

    console.log('✅ Rating workflow working');
  }

  /**
   * Test reporting workflow
   */
  private async testReportingWorkflow(): Promise<void> {
    console.log('🚨 Testing reporting workflow...');

    // Report smoke
    await request(this.app.getHttpServer())
      .post(`/smokes/${this.testSmoke.id}/report`)
      .set('Authorization', `Bearer ${this.testUser.token}`)
      .send({ reason: 'This smoke strategy is inappropriate and violates community guidelines.' })
      .expect(201);

    // Test invalid report (reason too short)
    await request(this.app.getHttpServer())
      .post(`/smokes/${this.testSmoke.id}/report`)
      .set('Authorization', `Bearer ${this.testUser.token}`)
      .send({ reason: 'Bad' })
      .expect(400);

    // Test unauthorized reporting
    await request(this.app.getHttpServer())
      .post(`/smokes/${this.testSmoke.id}/report`)
      .send({ reason: 'This smoke strategy is inappropriate and violates community guidelines.' })
      .expect(401);

    console.log('✅ Reporting workflow working');
  }

  /**
   * Test error scenarios
   */
  private async testErrorScenarios(): Promise<void> {
    console.log('🚫 Testing error scenarios...');

    // Test 404 scenarios
    await request(this.app.getHttpServer())
      .get('/maps/99999/smokes')
      .expect(404);

    await request(this.app.getHttpServer())
      .post('/smokes/99999/rate')
      .set('Authorization', `Bearer ${this.testUser.token}`)
      .send({ value: 1 })
      .expect(404);

    await request(this.app.getHttpServer())
      .post('/smokes/99999/report')
      .set('Authorization', `Bearer ${this.testUser.token}`)
      .send({ reason: 'This smoke strategy is inappropriate.' })
      .expect(404);

    // Test validation errors
    await request(this.app.getHttpServer())
      .post('/smokes')
      .set('Authorization', `Bearer ${this.testUser.token}`)
      .send({
        title: '', // Invalid: empty title
        videoUrl: 'not-a-url', // Invalid: not a URL
        timestamp: -1, // Invalid: negative timestamp
        x_coord: 'not-a-number', // Invalid: not a number
        y_coord: 200.7,
        mapId: this.testMap.id
      })
      .expect(400);

    console.log('✅ Error scenarios working');
  }

  /**
   * Test security scenarios
   */
  private async testSecurityScenarios(): Promise<void> {
    console.log('🔒 Testing security scenarios...');

    // Test smoke deletion by owner
    await request(this.app.getHttpServer())
      .delete(`/smokes/${this.testSmoke.id}`)
      .set('Authorization', `Bearer ${this.testUser.token}`)
      .expect(200);

    // Verify smoke is deleted
    await request(this.app.getHttpServer())
      .get(`/maps/${this.testMap.id}/smokes`)
      .expect(200)
      .then(response => {
        const deletedSmoke = response.body.find(s => s.id === this.testSmoke.id);
        if (deletedSmoke) {
          throw new Error('Smoke not deleted');
        }
      });

    // Test deletion of non-existent smoke
    await request(this.app.getHttpServer())
      .delete(`/smokes/${this.testSmoke.id}`)
      .set('Authorization', `Bearer ${this.testUser.token}`)
      .expect(404);

    console.log('✅ Security scenarios working');
  }

  /**
   * Clean up test environment
   */
  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test environment...');

    if (this.prisma) {
      // Clean up test data
      await this.prisma.report.deleteMany();
      await this.prisma.rating.deleteMany();
      await this.prisma.smoke.deleteMany();
      await this.prisma.user.deleteMany();
      await this.prisma.map.deleteMany();
    }

    if (this.app) {
      await this.app.close();
    }

    console.log('✅ Cleanup complete');
  }
}

// Run test if called directly
if (require.main === module) {
  const test = new FinalIntegrationTest();
  test.run().catch(console.error);
}

export { FinalIntegrationTest };