import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportSmokeDto } from '../common/dto/report-smoke.dto';
import { ReportStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new report for content moderation
   * Sets default status to PENDING for new reports
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