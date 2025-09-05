import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    generateJwtToken: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('steamAuthCallback', () => {
    it('should return token and user data on successful authentication', async () => {
      const mockUser = {
        id: 1,
        steamId: '76561198000000000',
        username: 'TestUser',
        avatarUrl: 'https://example.com/avatar.jpg',
      };

      const mockToken = 'jwt-token-123';
      mockAuthService.generateJwtToken.mockResolvedValue(mockToken);

      const mockReq = { user: mockUser } as any;
      const mockRes = {
        json: jest.fn(),
      } as any;

      await controller.steamAuthCallback(mockReq, mockRes);

      expect(mockAuthService.generateJwtToken).toHaveBeenCalledWith(mockUser);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Authentication successful',
        token: mockToken,
        user: {
          id: mockUser.id,
          steamId: mockUser.steamId,
          username: mockUser.username,
          avatarUrl: mockUser.avatarUrl,
        },
      });
    });

    it('should throw HttpException when no user data is received', async () => {
      const mockReq = { user: null } as any;
      const mockRes = {} as any;

      await expect(controller.steamAuthCallback(mockReq, mockRes)).rejects.toThrow(
        new HttpException(
          'Authentication failed: No user data received from Steam',
          HttpStatus.UNAUTHORIZED,
        ),
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile data', async () => {
      const mockUser = {
        id: 1,
        steamId: '76561198000000000',
        username: 'TestUser',
        avatarUrl: 'https://example.com/avatar.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReq = { user: mockUser } as any;

      const result = await controller.getProfile(mockReq);

      expect(result).toEqual({
        id: mockUser.id,
        steamId: mockUser.steamId,
        username: mockUser.username,
        avatarUrl: mockUser.avatarUrl,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });
  });
});