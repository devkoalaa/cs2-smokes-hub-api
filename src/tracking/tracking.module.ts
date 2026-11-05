import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TrackingController, TrackingPreviewController } from './tracking.controller';
import { TrackingService } from './tracking.service';

@Module({ imports: [AuthModule, PrismaModule], controllers: [TrackingPreviewController, TrackingController], providers: [TrackingService] })
export class TrackingModule {}
