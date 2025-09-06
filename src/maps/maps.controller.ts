import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { MapsService } from './maps.service';
import { ApiTags } from '@nestjs/swagger';
import { MapResponseDto } from '../common/dto/map-response.dto';

@ApiTags('maps')
@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get()
  async findAll(): Promise<MapResponseDto[]> {
    return this.mapsService.findAll();
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number): Promise<MapResponseDto> {
    return this.mapsService.findById(id);
  }
}