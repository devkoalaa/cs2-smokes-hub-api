import {
  Controller,
  Post,
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