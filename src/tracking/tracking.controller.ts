import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfigureTrackingDto, MatchQueryDto } from './tracking.dto';
import { TrackingService } from './tracking.service';

@ApiTags('partidas')
@Controller('tracking/preview')
export class TrackingPreviewController {
  constructor(private readonly service: TrackingService) {}
  @Get(':id/:key') preview(@Param('id', ParseIntPipe) id: number, @Param('key') key: string) { return this.service.preview(id, key); }
}

@ApiTags('partidas')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('tracking')
export class TrackingController {
  constructor(private readonly service: TrackingService) {}
  @Get('status') status(@Req() req: any) { return this.service.status(req.user.id, req.user.steamId); }
  @Post('settings') configure(@Req() req: any, @Body() dto: ConfigureTrackingDto) { return this.service.configure(req.user.id, req.user.steamId, dto); }
  @Delete('settings') disconnect(@Req() req: any) { return this.service.disconnect(req.user.id, req.user.steamId); }
  @Get('matches') matches(@Req() req: any, @Query() query: MatchQueryDto) { return this.service.dashboard(req.user.id, req.user.steamId, query); }
  @Get('matches/:id') detail(@Req() req: any, @Param('id', ParseIntPipe) id: number) { return this.service.detail(req.user.steamId, id); }
}
