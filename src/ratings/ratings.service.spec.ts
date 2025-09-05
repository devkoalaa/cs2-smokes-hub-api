import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { PrismaService } from '../prisma/prisma.service';
import { RateSmokeDto } from '../common/dto/rate-smoke.dto';

describe('RatingsService', () => {
  let service: RatingsService;
  let prismaService: any;

  const mockUser = {
    id: 1,
  };

  const mockSmoke = {
    id: 1,
  };

  const mockRating = {
    id: 1,
    userId: 1,
    smokeId: 1,
    value: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
      },
      smoke: {
        findUnique: jest.fn(),
      },
      rating: {
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RatingsService>(RatingsService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upsertRating', () => {
    it('should create new rating with valid data', async () => {
      // Arrange
      const userId = 1;
      const smokeId = 1;
      const rateSmokeDto: RateSmokeDto = { value: 1 };

      prismaService.smoke.findUnique.mockResolvedValue(mockSmoke);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.rating.upsert.mockResolvedValue(mockRating);

      // Act
      await service.upsertRating(userId, smokeId, rateSmokeDto);

      // Assert
      expect(prismaService.smoke.findUnique).toHaveBeenCalledWith({
        where: { id: smokeId },
        select: { id: true },
      });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true },
      });
      expect(prismaService.rating.upsert).toHaveBeenCalledWith({
        where: {
          userId_smokeId: {
            userId,
            smokeId,
          },
        },
        update: {
          value: rateSmokeDto.value,
        },
        create: {
          userId,
          smokeId,
          value: rateSmokeDto.value,
        },
      });
    });

    it('should update existing rating with valid data', async () => {
      // Arrange
      const userId = 1;
      const smokeId = 1;
      const rateSmokeDto: RateSmokeDto = { value: -1 };
      const updatedRating = { ...mockRating, value: -1 };

      prismaService.smoke.findUnique.mockResolvedValue(mockSmoke);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.rating.upsert.mockResolvedValue(updatedRating);

      // Act
      await service.upsertRating(userId, smokeId, rateSmokeDto);

      // Assert
      expect(prismaService.rating.upsert).toHaveBeenCalledWith({
        where: {
          userId_smokeId: {
            userId,
            smokeId,
          },
        },
        update: {
          value: -1,
        },
        create: {
          userId,
          smokeId,
          value: -1,
        },
      });
    });

    it('should throw BadRequestException for invalid rating value', async () => {
      // Arrange
      const userId = 1;
      const smokeId = 1;
      const invalidRateSmokeDto: RateSmokeDto = { value: 2 }; // Invalid value

      // Act & Assert
      await expect(service.upsertRating(userId, smokeId, invalidRateSmokeDto)).rejects.toThrow(
        new BadRequestException('Rating value must be either 1 or -1'),
      );

      // Verify that no database operations were called
      expect(prismaService.smoke.findUnique).not.toHaveBeenCalled();
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
      expect(prismaService.rating.upsert).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for zero rating value', async () => {
      // Arrange
      const userId = 1;
      const smokeId = 1;
      const invalidRateSmokeDto: RateSmokeDto = { value: 0 }; // Invalid value

      // Act & Assert
      await expect(service.upsertRating(userId, smokeId, invalidRateSmokeDto)).rejects.toThrow(
        new BadRequestException('Rating value must be either 1 or -1'),
      );
    });

    it('should throw NotFoundException for non-existent smoke', async () => {
      // Arrange
      const userId = 1;
      const smokeId = 999;
      const rateSmokeDto: RateSmokeDto = { value: 1 };

      prismaService.smoke.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.upsertRating(userId, smokeId, rateSmokeDto)).rejects.toThrow(
        new NotFoundException(`Smoke with ID ${smokeId} not found`),
      );

      // Verify that user lookup and upsert were not called
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
      expect(prismaService.rating.upsert).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent user', async () => {
      // Arrange
      const userId = 999;
      const smokeId = 1;
      const rateSmokeDto: RateSmokeDto = { value: 1 };

      prismaService.smoke.findUnique.mockResolvedValue(mockSmoke);
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.upsertRating(userId, smokeId, rateSmokeDto)).rejects.toThrow(
        new NotFoundException(`User with ID ${userId} not found`),
      );

      // Verify that upsert was not called
      expect(prismaService.rating.upsert).not.toHaveBeenCalled();
    });

    it('should validate rating value before checking smoke existence', async () => {
      // Arrange
      const userId = 1;
      const smokeId = 1;
      const invalidRateSmokeDto: RateSmokeDto = { value: 5 };

      // Act & Assert
      await expect(service.upsertRating(userId, smokeId, invalidRateSmokeDto)).rejects.toThrow(
        BadRequestException,
      );

      // Verify that no database operations were performed
      expect(prismaService.smoke.findUnique).not.toHaveBeenCalled();
    });

    it('should handle positive rating value correctly', async () => {
      // Arrange
      const userId = 1;
      const smokeId = 1;
      const rateSmokeDto: RateSmokeDto = { value: 1 };

      prismaService.smoke.findUnique.mockResolvedValue(mockSmoke);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.rating.upsert.mockResolvedValue(mockRating);

      // Act
      await service.upsertRating(userId, smokeId, rateSmokeDto);

      // Assert
      expect(prismaService.rating.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { value: 1 },
          create: expect.objectContaining({ value: 1 }),
        }),
      );
    });

    it('should handle negative rating value correctly', async () => {
      // Arrange
      const userId = 1;
      const smokeId = 1;
      const rateSmokeDto: RateSmokeDto = { value: -1 };

      prismaService.smoke.findUnique.mockResolvedValue(mockSmoke);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.rating.upsert.mockResolvedValue({ ...mockRating, value: -1 });

      // Act
      await service.upsertRating(userId, smokeId, rateSmokeDto);

      // Assert
      expect(prismaService.rating.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { value: -1 },
          create: expect.objectContaining({ value: -1 }),
        }),
      );
    });
  });
});