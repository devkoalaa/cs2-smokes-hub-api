import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { ReportSmokeDto } from '../common/dto/report-smoke.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /smokes/:smokeId/report/status
   * Check if the current user has already reported this smoke
   * Protected endpoint - requires JWT authentication
   */
  @Get('smokes/:smokeId/report/status')
  @UseGuards(JwtAuthGuard)
  async getReportStatus(
    @Param('smokeId', ParseIntPipe) smokeId: number,
    @Request() req: { user: JwtPayload },
  ): Promise<{ hasReported: boolean }> {
    const reporterId = req.user.sub;
    
    const hasReported = await this.reportsService.hasUserReported(smokeId, reporterId);
    
    return { hasReported };
  }

  /**
   * POST /reports/status/batch
   * Check report status for multiple smokes at once
   * Protected endpoint - requires JWT authentication
   */
  @Post('reports/status/batch')
  @UseGuards(JwtAuthGuard)
  async getReportsStatusBatch(
    @Body() body: { smokeIds: number[] },
    @Request() req: { user: JwtPayload },
  ): Promise<{ smokeId: number; hasReported: boolean }[]> {
    const reporterId = req.user.sub;
    
    return await this.reportsService.getReportsStatusForSmokes(body.smokeIds, reporterId);
  }

  /**
   * POST /smokes/:smokeId/report
   * Report a smoke for content moderation
   * Protected endpoint - requires JWT authentication
   */
  @Post('smokes/:smokeId/report')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async reportSmoke(
    @Param('smokeId', ParseIntPipe) smokeId: number,
    @Body() reportSmokeDto: ReportSmokeDto,
    @Request() req: { user: JwtPayload },
  ): Promise<{ message: string }> {
    const reporterId = req.user.sub;
    
    await this.reportsService.create(smokeId, reporterId, reportSmokeDto);
    
    return { message: 'Report submitted successfully' };
  }
}