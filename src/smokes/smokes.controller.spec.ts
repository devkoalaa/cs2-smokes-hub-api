import { Test, TestingModule } from '@nestjs/testing';
import { SmokesController } from './smokes.controller';
import { SmokesService } from './smokes.service';
import { CreateSmokeDto } from '../common/dto/create-smoke.dto';
import { SmokeResponseDto } from '../common/dto/smoke-response.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('SmokesController', () => {
  let controller: SmokesController;
  let service: SmokesService;

  const mockSmokesService = {
    findByMapId: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };

  const mockJwtPayload: JwtPayload = {
    sub: 1,
    steamId: '76561198000000000',
    username: 'testuser',
  };

  const mockSmokeResponse: SmokeResponseDto = {
    id: 1,
    title: 'Test Smoke',
    videoUrl: 'https://example.com/video',
    timestamp: 30,
    x_coord: 100.5,
    y_coord: 200.5,
    score: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: {
      id: 1,
      steamId: '76561198000000000',
      displayName: 'testuser',
      avatarUrl: 'https://example.com/avatar.jpg',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    map: {
      id: 1,
      name: 'de_dust2',
      imageUrl: 'https://example.com/dust2.jpg',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SmokesController],
      providers: [
        {
          provide: SmokesService,
          useValue: mockSmokesService,
        },
      ],
    }).compile();

    controller = module.get<SmokesController>(SmokesController);
    service = module.get<SmokesService>(SmokesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSmokesByMapId', () => {
    it('should return smokes for a valid map ID', async () => {
      const mapId = 1;
      const expectedSmokes = [mockSmokeResponse];

      mockSmokesService.findByMapId.mockResolvedValue(expectedSmokes);

      const result = await controller.getSmokesByMapId(mapId);

      expect(service.findByMapId).toHaveBeenCalledWith(mapId);
      expect(result).toEqual(expectedSmokes);
    });

    it('should handle service errors', async () => {
      const mapId = 999;
      const error = new Error('Map not found');

      mockSmokesService.findByMapId.mockRejectedValue(error);

      await expect(controller.getSmokesByMapId(mapId)).rejects.toThrow(error);
      expect(service.findByMapId).toHaveBeenCalledWith(mapId);
    });
  });

  describe('createSmoke', () => {
    const createSmokeDto: CreateSmokeDto = {
      title: 'Test Smoke',
      videoUrl: 'https://example.com/video',
      timestamp: 30,
      x_coord: 100.5,
      y_coord: 200.5,
      mapId: 1,
    };

    it('should create a smoke with authenticated user', async () => {
      const mockRequest = { user: mockJwtPayload };

      mockSmokesService.create.mockResolvedValue(mockSmokeResponse);

      const result = await controller.createSmoke(createSmokeDto, mockRequest);

      expect(service.create).toHaveBeenCalledWith(createSmokeDto, mockJwtPayload.sub);
      expect(result).toEqual(mockSmokeResponse);
    });

    it('should handle service errors during creation', async () => {
      const mockRequest = { user: mockJwtPayload };
      const error = new Error('Map not found');

      mockSmokesService.create.mockRejectedValue(error);

      await expect(controller.createSmoke(createSmokeDto, mockRequest)).rejects.toThrow(error);
      expect(service.create).toHaveBeenCalledWith(createSmokeDto, mockJwtPayload.sub);
    });
  });

  describe('deleteSmoke', () => {
    it('should delete a smoke with authenticated user', async () => {
      const smokeId = 1;
      const mockRequest = { user: mockJwtPayload };

      mockSmokesService.delete.mockResolvedValue(undefined);

      const result = await controller.deleteSmoke(smokeId, mockRequest);

      expect(service.delete).toHaveBeenCalledWith(smokeId, mockJwtPayload.sub);
      expect(result).toBeUndefined();
    });

    it('should handle service errors during deletion', async () => {
      const smokeId = 999;
      const mockRequest = { user: mockJwtPayload };
      const error = new Error('Smoke not found');

      mockSmokesService.delete.mockRejectedValue(error);

      await expect(controller.deleteSmoke(smokeId, mockRequest)).rejects.toThrow(error);
      expect(service.delete).toHaveBeenCalledWith(smokeId, mockJwtPayload.sub);
    });
  });
});