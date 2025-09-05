import { Test, TestingModule } from '@nestjs/testing';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { RateSmokeDto } from '../common/dto/rate-smoke.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('RatingsController', () => {
  let controller: RatingsController;
  let ratingsService: RatingsService;

  const mockRatingsService = {
    upsertRating: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RatingsController],
      providers: [
        {
          provide: RatingsService,
          useValue: mockRatingsService,
        },
      ],
    }).compile();

    controller = module.get<RatingsController>(RatingsController);
    ratingsService = module.get<RatingsService>(RatingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('rateSmoke', () => {
    const mockUser: JwtPayload = {
      sub: 1,
      steamId: '76561198000000000',
      username: 'testuser',
    };

    const mockRequest = { user: mockUser };

    it('should successfully rate a smoke with valid data', async () => {
      const smokeId = 1;
      const rateSmokeDto: RateSmokeDto = { value: 1 };

      mockRatingsService.upsertRating.mockResolvedValue(undefined);

      const result = await controller.rateSmoke(smokeId, rateSmokeDto, mockRequest);

      expect(ratingsService.upsertRating).toHaveBeenCalledWith(
        mockUser.sub,
        smokeId,
        rateSmokeDto,
      );
      expect(result).toEqual({ message: 'Rating submitted successfully' });
    });

    it('should successfully rate a smoke with downvote', async () => {
      const smokeId = 2;
      const rateSmokeDto: RateSmokeDto = { value: -1 };

      mockRatingsService.upsertRating.mockResolvedValue(undefined);

      const result = await controller.rateSmoke(smokeId, rateSmokeDto, mockRequest);

      expect(ratingsService.upsertRating).toHaveBeenCalledWith(
        mockUser.sub,
        smokeId,
        rateSmokeDto,
      );
      expect(result).toEqual({ message: 'Rating submitted successfully' });
    });

    it('should extract userId from JWT payload correctly', async () => {
      const smokeId = 3;
      const rateSmokeDto: RateSmokeDto = { value: 1 };
      const customUser: JwtPayload = {
        sub: 999,
        steamId: '76561198999999999',
        username: 'customuser',
      };
      const customRequest = { user: customUser };

      mockRatingsService.upsertRating.mockResolvedValue(undefined);

      await controller.rateSmoke(smokeId, rateSmokeDto, customRequest);

      expect(ratingsService.upsertRating).toHaveBeenCalledWith(
        customUser.sub,
        smokeId,
        rateSmokeDto,
      );
    });

    it('should propagate service errors', async () => {
      const smokeId = 1;
      const rateSmokeDto: RateSmokeDto = { value: 1 };
      const error = new Error('Service error');

      mockRatingsService.upsertRating.mockRejectedValue(error);

      await expect(
        controller.rateSmoke(smokeId, rateSmokeDto, mockRequest),
      ).rejects.toThrow('Service error');

      expect(ratingsService.upsertRating).toHaveBeenCalledWith(
        mockUser.sub,
        smokeId,
        rateSmokeDto,
      );
    });
  });
});