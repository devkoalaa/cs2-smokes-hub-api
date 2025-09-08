import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { MapsService } from './maps.service';

describe('MapsService', () => {
  let service: MapsService;

  const mockPrismaService = {
    map: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MapsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MapsService>(MapsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all maps', async () => {
      const expectedMaps = [
        { id: 1, name: 'Dust2', description: 'Classic desert map', thumbnail: 'dust2.jpg', radar: 'dust2_radar.jpg', _count: { smokes: 5 } },
        { id: 2, name: 'Mirage', description: 'Middle Eastern city map', thumbnail: 'mirage.jpg', radar: 'mirage_radar.jpg', _count: { smokes: 8 } },
      ];

      mockPrismaService.map.findMany.mockResolvedValue(expectedMaps);

      const result = await service.findAll();

      expect(mockPrismaService.map.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          description: true,
          thumbnail: true,
          radar: true,
          _count: { select: { smokes: true } },
        },
      });
      expect(result).toEqual([
        { id: 1, name: 'Dust2', description: 'Classic desert map', thumbnail: 'dust2.jpg', radar: 'dust2_radar.jpg', smokesCount: 5 },
        { id: 2, name: 'Mirage', description: 'Middle Eastern city map', thumbnail: 'mirage.jpg', radar: 'mirage_radar.jpg', smokesCount: 8 },
      ]);
    });

    it('should return empty array when no maps exist', async () => {
      mockPrismaService.map.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return map when found', async () => {
      const expectedMap = { id: 1, name: 'Dust2', description: 'Classic desert map', thumbnail: 'dust2.jpg', radar: 'dust2_radar.jpg', _count: { smokes: 5 } };

      mockPrismaService.map.findUnique.mockResolvedValue(expectedMap);

      const result = await service.findById(1);

      expect(mockPrismaService.map.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          name: true,
          description: true,
          thumbnail: true,
          radar: true,
          _count: { select: { smokes: true } },
        },
      });
      expect(result).toEqual({
        id: 1,
        name: 'Dust2',
        description: 'Classic desert map',
        thumbnail: 'dust2.jpg',
        radar: 'dust2_radar.jpg',
        smokesCount: 5,
      });
    });

    it('should throw NotFoundException when map not found', async () => {
      mockPrismaService.map.findUnique.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(
        new NotFoundException('Map with ID 999 not found'),
      );

      expect(mockPrismaService.map.findUnique).toHaveBeenCalledWith({
        where: { id: 999 },
        select: {
          id: true,
          name: true,
          description: true,
          thumbnail: true,
          radar: true,
          _count: { select: { smokes: true } },
        },
      });
    });
  });
});