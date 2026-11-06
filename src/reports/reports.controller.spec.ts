import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportSmokeDto } from '../common/dto/report-smoke.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsService;

  const mockReportsService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: mockReportsService,
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('reportSmoke', () => {
    const mockJwtPayload: JwtPayload = {
      sub: 1,
      steamId: '76561198000000000',
      username: 'testuser',
    };

    const mockRequest = { user: mockJwtPayload };
    const reportSmokeDto: ReportSmokeDto = {
      reason: 'This smoke contains inappropriate content that violates community guidelines',
    };

    it('should create a report successfully', async () => {
      const smokeId = 123;
      mockReportsService.create.mockResolvedValue(undefined);

      const result = await controller.reportSmoke(smokeId, reportSmokeDto, mockRequest);

      expect(service.create).toHaveBeenCalledWith(smokeId, mockJwtPayload.sub, reportSmokeDto);
      expect(result).toEqual({ message: 'Report submitted successfully' });
    });

    it('should extract reporterId from JWT payload', async () => {
      const smokeId = 456;
      const customPayload: JwtPayload = {
        sub: 999,
        steamId: '76561198111111111',
        username: 'anotheruser',
      };
      const customRequest = { user: customPayload };

      mockReportsService.create.mockResolvedValue(undefined);

      await controller.reportSmoke(smokeId, reportSmokeDto, customRequest);

      expect(service.create).toHaveBeenCalledWith(smokeId, customPayload.sub, reportSmokeDto);
    });

    it('should handle service errors', async () => {
      const smokeId = 789;
      const error = new Error('Service error');
      mockReportsService.create.mockRejectedValue(error);

      await expect(
        controller.reportSmoke(smokeId, reportSmokeDto, mockRequest),
      ).rejects.toThrow('Service error');

      expect(service.create).toHaveBeenCalledWith(smokeId, mockJwtPayload.sub, reportSmokeDto);
    });
  });
});