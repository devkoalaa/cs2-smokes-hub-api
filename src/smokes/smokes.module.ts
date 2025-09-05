import { Module } from '@nestjs/common';
import { SmokesService } from './smokes.service';
import { SmokesController } from './smokes.controller';

@Module({
  controllers: [SmokesController],
  providers: [SmokesService],
  exports: [SmokesService],
})
export class SmokesModule {}