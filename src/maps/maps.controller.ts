import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { MapsService } from './maps.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('maps')
@Controller('maps')
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get()
  async findAll() {
    return this.mapsService.findAll();
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.mapsService.findById(id);
  }
}