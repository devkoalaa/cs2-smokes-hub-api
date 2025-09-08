import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportSmokeDto } from '../common/dto/report-smoke.dto';
import { ReportStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a user has already reported a specific smoke
   */
  async hasUserReported(smokeId: number, reporterId: number): Promise<boolean> {
    const existingReport = await this.prisma.report.findUnique({
      where: {
        reporterId_smokeId: {
          reporterId,
          smokeId,
        },
      },
    });

    return !!existingReport;
  }

  /**
   * Get report status for multiple smokes at once
   */
  async getReportsStatusForSmokes(smokeIds: number[], reporterId: number): Promise<{ smokeId: number; hasReported: boolean }[]> {
    const reports = await this.prisma.report.findMany({
      where: {
        reporterId,
        smokeId: {
          in: smokeIds,
        },
      },
      select: {
        smokeId: true,
      },
    });

    const reportedSmokeIds = new Set(reports.map(report => report.smokeId));
    
    return smokeIds.map(smokeId => ({
      smokeId,
      hasReported: reportedSmokeIds.has(smokeId),
    }));
  }

  /**
   * Create a new report for content moderation
   * Sets default status to PENDING for new reports
   * Prevents duplicate reports from the same user for the same smoke
   */
  async create(smokeId: number, reporterId: number, reportSmokeDto: ReportSmokeDto): Promise<void> {
    const { reason } = reportSmokeDto;

    // Validate that reason is provided (additional validation beyond DTO)
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Report reason is required');
    }

    // Verify the smoke exists and is not deleted
    const smokeExists = await this.prisma.smoke.findUnique({
      where: { id: smokeId },
      select: { id: true, deletedAt: true },
    });

    if (!smokeExists || smokeExists.deletedAt) {
      throw new NotFoundException(`Smoke with ID ${smokeId} not found`);
    }

    // Verify the reporter exists
    const reporterExists = await this.prisma.user.findUnique({
      where: { id: reporterId },
      select: { id: true },
    });

    if (!reporterExists) {
      throw new NotFoundException(`User with ID ${reporterId} not found`);
    }

    // Check if user has already reported this smoke
    const existingReport = await this.prisma.report.findUnique({
      where: {
        reporterId_smokeId: {
          reporterId,
          smokeId,
        },
      },
    });

    if (existingReport) {
      throw new BadRequestException('You have already reported this smoke');
    }

    // Create the report with default PENDING status
    await this.prisma.report.create({
      data: {
        reason: reason.trim(),
        status: ReportStatus.PENDING,
        reporterId,
        smokeId,
      },
    });
  }
}