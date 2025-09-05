import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: any;
  let jwtService: any;

  const mockUser = {
    id: 1,
    steamId: '76561198000000000',
    username: 'TestUser',
    avatarUrl: 'https://example.com/avatar.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSteamProfile = {
    id: '76561198000000000',
    displayName: 'TestUser',
    username: 'TestUser',
    photos: [
      { value: 'https://example.com/avatar_small.jpg' },
      { value: 'https://example.com/avatar_medium.jpg' },
      { value: 'https://example.com/avatar_large.jpg' },
    ],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockJwtService = {
      sign: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateSteamUser', () => {
    it('should create a new user when user does not exist', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(mockUser);

      // Act
      const result = await service.validateSteamUser(mockSteamProfile);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { steamId: mockSteamProfile.id },
      });
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          steamId: mockSteamProfile.id,
          username: mockSteamProfile.displayName,
          avatarUrl: mockSteamProfile.photos[2].value,
        },
      });
      expect(result).toEqual(mockUser);
    });

    it('should update existing user when user already exists', async () => {
      // Arrange
      const existingUser = { ...mockUser };
      const updatedUser = { ...mockUser, username: 'UpdatedUser' };
      prismaService.user.findUnique.mockResolvedValue(existingUser);
      prismaService.user.update.mockResolvedValue(updatedUser);

      const updatedProfile = {
        ...mockSteamProfile,
        displayName: 'UpdatedUser',
      };

      // Act
      const result = await service.validateSteamUser(updatedProfile);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { steamId: updatedProfile.id },
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { steamId: updatedProfile.id },
        data: {
          username: updatedProfile.displayName,
          avatarUrl: updatedProfile.photos[2].value,
        },
      });
      expect(result).toEqual(updatedUser);
    });

    it('should handle profile with no photos', async () => {
      // Arrange
      const profileWithoutPhotos = {
        id: '76561198000000000',
        displayName: 'TestUser',
        username: 'TestUser',
      };
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(mockUser);

      // Act
      await service.validateSteamUser(profileWithoutPhotos);

      // Assert
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          steamId: profileWithoutPhotos.id,
          username: profileWithoutPhotos.displayName,
          avatarUrl: undefined,
        },
      });
    });

    it('should use username as fallback when displayName is not available', async () => {
      // Arrange
      const profileWithUsernameOnly = {
        id: '76561198000000000',
        username: 'TestUser',
        photos: [{ value: 'https://example.com/avatar.jpg' }],
      };
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(mockUser);

      // Act
      await service.validateSteamUser(profileWithUsernameOnly);

      // Assert
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          steamId: profileWithUsernameOnly.id,
          username: profileWithUsernameOnly.username,
          avatarUrl: profileWithUsernameOnly.photos[0].value,
        },
      });
    });

    it('should prefer larger avatar photos when multiple are available', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(mockUser);

      // Act
      await service.validateSteamUser(mockSteamProfile);

      // Assert
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          steamId: mockSteamProfile.id,
          username: mockSteamProfile.displayName,
          avatarUrl: mockSteamProfile.photos[2].value, // Should use the largest (index 2)
        },
      });
    });
  });

  describe('generateJwtToken', () => {
    it('should generate JWT token with correct payload', async () => {
      // Arrange
      const expectedToken = 'mock.jwt.token';
      const expectedPayload: JwtPayload = {
        sub: mockUser.id,
        steamId: mockUser.steamId,
        username: mockUser.username,
      };
      jwtService.sign.mockReturnValue(expectedToken);

      // Act
      const result = await service.generateJwtToken(mockUser);

      // Assert
      expect(jwtService.sign).toHaveBeenCalledWith(expectedPayload);
      expect(result).toBe(expectedToken);
    });

    it('should handle user with minimal data', async () => {
      // Arrange
      const minimalUser = {
        id: 2,
        steamId: '76561198000000001',
        username: 'MinimalUser',
      };
      const expectedToken = 'minimal.jwt.token';
      const expectedPayload: JwtPayload = {
        sub: minimalUser.id,
        steamId: minimalUser.steamId,
        username: minimalUser.username,
      };
      jwtService.sign.mockReturnValue(expectedToken);

      // Act
      const result = await service.generateJwtToken(minimalUser);

      // Assert
      expect(jwtService.sign).toHaveBeenCalledWith(expectedPayload);
      expect(result).toBe(expectedToken);
    });
  });
});