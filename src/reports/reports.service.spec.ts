import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportSmokeDto } from '../common/dto/report-smoke.dto';
import { ReportStatus } from '@prisma/client';

describe('ReportsService', () => {
  let service: ReportsService;
  let prismaService: any;

  const mockUser = {
    id: 1,
  };

  const mockSmoke = {
    id: 1,
  };

  const mockReport = {
    id: 1,
    reason: 'This smoke is inappropriate',
    status: ReportStatus.PENDING,
    reporterId: 1,
    smokeId: 1,
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
      report: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create report successfully with valid data', async () => {
      // Arrange
      const smokeId = 1;
      const reporterId = 1;
      const reportSmokeDto: ReportSmokeDto = {
        reason: 'This smoke contains inappropriate content',
      };

      prismaService.smoke.findUnique.mockResolvedValue(mockSmoke);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.report.create.mockResolvedValue(mockReport);

      // Act
      await service.create(smokeId, reporterId, reportSmokeDto);

      // Assert
      expect(prismaService.smoke.findUnique).toHaveBeenCalledWith({
        where: { id: smokeId },
        select: { id: true },
      });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: reporterId },
        select: { id: true },
      });
      expect(prismaService.report.create).toHaveBeenCalledWith({
        data: {
          reason: reportSmokeDto.reason.trim(),
          status: ReportStatus.PENDING,
          reporterId,
          smokeId,
        },
      });
    });

    it('should trim whitespace from reason before creating report', async () => {
      // Arrange
      const smokeId = 1;
      const reporterId = 1;
      const reportSmokeDto: ReportSmokeDto = {
        reason: '  This smoke has inappropriate content  ',
      };

      prismaService.smoke.findUnique.mockResolvedValue(mockSmoke);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.report.create.mockResolvedValue(mockReport);

      // Act
      await service.create(smokeId, reporterId, reportSmokeDto);

      // Assert
      expect(prismaService.report.create).toHaveBeenCalledWith({
        data: {
          reason: 'This smoke has inappropriate content', // Trimmed
          status: ReportStatus.PENDING,
          reporterId,
          smokeId,
        },
      });
    });

    it('should throw BadRequestException for empty reason', async () => {
      // Arrange
      const smokeId = 1;
      const reporterId = 1;
      const reportSmokeDto: ReportSmokeDto = {
        reason: '',
      };

      // Act & Assert
      await expect(service.create(smokeId, reporterId, reportSmokeDto)).rejects.toThrow(
        new BadRequestException('Report reason is required'),
      );

      // Verify that no database operations were called
      expect(prismaService.smoke.findUnique).not.toHaveBeenCalled();
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
      expect(prismaService.report.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for whitespace-only reason', async () => {
      // Arrange
      const smokeId = 1;
      const reporterId = 1;
      const reportSmokeDto: ReportSmokeDto = {
        reason: '   ',
      };

      // Act & Assert
      await expect(service.create(smokeId, reporterId, reportSmokeDto)).rejects.toThrow(
        new BadRequestException('Report reason is required'),
      );

      // Verify that no database operations were called
      expect(prismaService.smoke.findUnique).not.toHaveBeenCalled();
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
      expect(prismaService.report.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for null reason', async () => {
      // Arrange
      const smokeId = 1;
      const reporterId = 1;
      const reportSmokeDto: ReportSmokeDto = {
        reason: null as any,
      };

      // Act & Assert
      await expect(service.create(smokeId, reporterId, reportSmokeDto)).rejects.toThrow(
        new BadRequestException('Report reason is required'),
      );
    });

    it('should throw NotFoundException for non-existent smoke', async () => {
      // Arrange
      const smokeId = 999;
      const reporterId = 1;
      const reportSmokeDto: ReportSmokeDto = {
        reason: 'This smoke is inappropriate',
      };

      prismaService.smoke.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(smokeId, reporterId, reportSmokeDto)).rejects.toThrow(
        new NotFoundException(`Smoke with ID ${smokeId} not found`),
      );

      // Verify that user lookup and report creation were not called
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
      expect(prismaService.report.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent reporter', async () => {
      // Arrange
      const smokeId = 1;
      const reporterId = 999;
      const reportSmokeDto: ReportSmokeDto = {
        reason: 'This smoke is inappropriate',
      };

      prismaService.smoke.findUnique.mockResolvedValue(mockSmoke);
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(smokeId, reporterId, reportSmokeDto)).rejects.toThrow(
        new NotFoundException(`User with ID ${reporterId} not found`),
      );

      // Verify that report creation was not called
      expect(prismaService.report.create).not.toHaveBeenCalled();
    });

    it('should validate reason before checking smoke existence', async () => {
      // Arrange
      const smokeId = 1;
      const reporterId = 1;
      const reportSmokeDto: ReportSmokeDto = {
        reason: '',
      };

      // Act & Assert
      await expect(service.create(smokeId, reporterId, reportSmokeDto)).rejects.toThrow(
        BadRequestException,
      );

      // Verify that no database operations were performed
      expect(prismaService.smoke.findUnique).not.toHaveBeenCalled();
    });

    it('should set default status to PENDING for new reports', async () => {
      // Arrange
      const smokeId = 1;
      const reporterId = 1;
      const reportSmokeDto: ReportSmokeDto = {
        reason: 'Valid report reason',
      };

      prismaService.smoke.findUnique.mockResolvedValue(mockSmoke);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.report.create.mockResolvedValue(mockReport);

      // Act
      await service.create(smokeId, reporterId, reportSmokeDto);

      // Assert
      expect(prismaService.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: ReportStatus.PENDING,
        }),
      });
    });

    it('should handle long valid reasons correctly', async () => {
      // Arrange
      const smokeId = 1;
      const reporterId = 1;
      const longReason = 'This is a very long reason that explains in detail why this smoke should be reported for inappropriate content and violations of community guidelines';
      const reportSmokeDto: ReportSmokeDto = {
        reason: longReason,
      };

      prismaService.smoke.findUnique.mockResolvedValue(mockSmoke);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.report.create.mockResolvedValue(mockReport);

      // Act
      await service.create(smokeId, reporterId, reportSmokeDto);

      // Assert
      expect(prismaService.report.create).toHaveBeenCalledWith({
        data: {
          reason: longReason,
          status: ReportStatus.PENDING,
          reporterId,
          smokeId,
        },
      });
    });

    it('should handle minimum length valid reasons correctly', async () => {
      // Arrange
      const smokeId = 1;
      const reporterId = 1;
      const minReason = 'Bad smoke';
      const reportSmokeDto: ReportSmokeDto = {
        reason: minReason,
      };

      prismaService.smoke.findUnique.mockResolvedValue(mockSmoke);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.report.create.mockResolvedValue(mockReport);

      // Act
      await service.create(smokeId, reporterId, reportSmokeDto);

      // Assert
      expect(prismaService.report.create).toHaveBeenCalledWith({
        data: {
          reason: minReason,
          status: ReportStatus.PENDING,
          reporterId,
          smokeId,
        },
      });
    });
  });
});