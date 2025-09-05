import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthModule } from './auth.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthModule', () => {
  let module: TestingModule;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              JWT_SECRET: 'test-jwt-secret-for-testing',
              DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
              STEAM_API_KEY: 'test-steam-api-key',
            }),
          ],
        }),
        AuthModule,
      ],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide JwtService', () => {
    expect(jwtService).toBeDefined();
    expect(jwtService).toBeInstanceOf(JwtService);
  });

  it('should provide JwtStrategy', () => {
    const jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
    expect(jwtStrategy).toBeDefined();
    expect(jwtStrategy).toBeInstanceOf(JwtStrategy);
  });

  it('should configure JWT with correct options', () => {
    // Test that JWT service can sign and verify tokens
    const payload = { sub: 1, username: 'test' };
    const token = jwtService.sign(payload);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    
    const decoded = jwtService.verify(token);
    expect(decoded.sub).toBe(1);
    expect(decoded.username).toBe('test');
    expect(decoded.exp).toBeDefined(); // Should have expiration
  });
});