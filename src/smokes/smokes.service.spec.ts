import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { SmokesService } from './smokes.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSmokeDto } from '../common/dto/create-smoke.dto';

describe('SmokesService', () => {
  let service: SmokesService;
  let prismaService: any;

  const mockMap = {
    id: 1,
    name: 'Dust2',
    imageUrl: 'https://example.com/dust2.jpg',
  };

  const mockUser = {
    id: 1,
    steamId: '76561198000000000',
    username: 'TestUser',
    avatarUrl: 'https://example.com/avatar.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSmoke = {
    id: 1,
    title: 'Xbox Smoke',
    videoUrl: 'https://youtube.com/watch?v=test',
    timestamp: 30,
    x_coord: 100.5,
    y_coord: 200.5,
    createdAt: new Date(),
    updatedAt: new Date(),
    authorId: 1,
    mapId: 1,
  };

  const mockCreateSmokeDto: CreateSmokeDto = {
    title: 'Xbox Smoke',
    videoUrl: 'https://youtube.com/watch?v=test',
    timestamp: 30,
    x_coord: 100.5,
    y_coord: 200.5,
    mapId: 1,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      map: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      smoke: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmokesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SmokesService>(SmokesService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByMapId', () => {
    it('should return smokes with calculated scores for valid map', async () => {
      // Arrange
      const mapId = 1;
      const mockRawSmokes = [
        {
          ...mockSmoke,
          score: BigInt(5),
        },
      ];

      prismaService.map.findUnique.mockResolvedValue(mockMap);
      prismaService.$queryRaw.mockResolvedValue(mockRawSmokes);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.map.findUnique.mockResolvedValueOnce(mockMap); // For the second call

      // Act
      const result = await service.findByMapId(mapId);

      // Assert
      expect(prismaService.map.findUnique).toHaveBeenCalledWith({
        where: { id: mapId },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: mockSmoke.id,
        title: mockSmoke.title,
        score: 5, // BigInt converted to number
        author: {
          id: mockUser.id,
          displayName: mockUser.username,
        },
        map: mockMap,
      });
    });

    it('should throw NotFoundException for invalid map', async () => {
      // Arrange
      const invalidMapId = 999;
      prismaService.map.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findByMapId(invalidMapId)).rejects.toThrow(
        new NotFoundException(`Map with ID ${invalidMapId} not found`),
      );
    });

    it('should return empty array when map has no smokes', async () => {
      // Arrange
      const mapId = 1;
      prismaService.map.findUnique.mockResolvedValue(mockMap);
      prismaService.$queryRaw.mockResolvedValue([]);

      // Act
      const result = await service.findByMapId(mapId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle smokes with zero score', async () => {
      // Arrange
      const mapId = 1;
      const mockRawSmokes = [
        {
          ...mockSmoke,
          score: BigInt(0),
        },
      ];

      prismaService.map.findUnique.mockResolvedValue(mockMap);
      prismaService.$queryRaw.mockResolvedValue(mockRawSmokes);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.map.findUnique.mockResolvedValueOnce(mockMap);

      // Act
      const result = await service.findByMapId(mapId);

      // Assert
      expect(result[0].score).toBe(0);
    });
  });

  describe('create', () => {
    it('should create smoke successfully with valid data', async () => {
      // Arrange
      const authorId = 1;
      const createdSmoke = {
        ...mockSmoke,
        author: mockUser,
        map: mockMap,
      };

      prismaService.map.findUnique.mockResolvedValue(mockMap);
      prismaService.smoke.create.mockResolvedValue(createdSmoke);

      // Act
      const result = await service.create(mockCreateSmokeDto, authorId);

      // Assert
      expect(prismaService.map.findUnique).toHaveBeenCalledWith({
        where: { id: mockCreateSmokeDto.mapId },
      });
      expect(prismaService.smoke.create).toHaveBeenCalledWith({
        data: {
          title: mockCreateSmokeDto.title,
          videoUrl: mockCreateSmokeDto.videoUrl,
          timestamp: mockCreateSmokeDto.timestamp,
          x_coord: mockCreateSmokeDto.x_coord,
          y_coord: mockCreateSmokeDto.y_coord,
          authorId,
          mapId: mockCreateSmokeDto.mapId,
        },
        include: {
          author: {
            select: {
              id: true,
              steamId: true,
              username: true,
              avatarUrl: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          map: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
      });
      expect(result.score).toBe(0); // New smoke should have score 0
      expect(result.author.displayName).toBe(mockUser.username);
    });

    it('should throw NotFoundException for invalid map', async () => {
      // Arrange
      const authorId = 1;
      prismaService.map.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(mockCreateSmokeDto, authorId)).rejects.toThrow(
        new NotFoundException(`Map with ID ${mockCreateSmokeDto.mapId} not found`),
      );
    });
  });

  describe('delete', () => {
    it('should delete smoke successfully when user owns it', async () => {
      // Arrange
      const smokeId = 1;
      const userId = 1;
      const ownedSmoke = {
        id: smokeId,
        authorId: userId,
      };

      prismaService.smoke.findUnique.mockResolvedValue(ownedSmoke);
      prismaService.smoke.delete.mockResolvedValue(mockSmoke);

      // Act
      await service.delete(smokeId, userId);

      // Assert
      expect(prismaService.smoke.findUnique).toHaveBeenCalledWith({
        where: { id: smokeId },
        select: {
          id: true,
          authorId: true,
        },
      });
      expect(prismaService.smoke.delete).toHaveBeenCalledWith({
        where: { id: smokeId },
      });
    });

    it('should throw NotFoundException for non-existent smoke', async () => {
      // Arrange
      const smokeId = 999;
      const userId = 1;
      prismaService.smoke.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete(smokeId, userId)).rejects.toThrow(
        new NotFoundException(`Smoke with ID ${smokeId} not found`),
      );
    });

    it('should throw ForbiddenException when user does not own smoke', async () => {
      // Arrange
      const smokeId = 1;
      const userId = 2; // Different user
      const otherUserSmoke = {
        id: smokeId,
        authorId: 1, // Owned by user 1
      };

      prismaService.smoke.findUnique.mockResolvedValue(otherUserSmoke);

      // Act & Assert
      await expect(service.delete(smokeId, userId)).rejects.toThrow(
        new ForbiddenException('You can only delete your own smokes'),
      );
    });

    it('should not call delete when ownership validation fails', async () => {
      // Arrange
      const smokeId = 1;
      const userId = 2;
      const otherUserSmoke = {
        id: smokeId,
        authorId: 1,
      };

      prismaService.smoke.findUnique.mockResolvedValue(otherUserSmoke);

      // Act & Assert
      await expect(service.delete(smokeId, userId)).rejects.toThrow(ForbiddenException);
      expect(prismaService.smoke.delete).not.toHaveBeenCalled();
    });
  });
});