import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TrackingController, TrackingPreviewController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { BotTokenGuard, TrackingBotController, TrackingBotService } from './tracking.bot';

@Module({ imports: [AuthModule, PrismaModule], controllers: [TrackingPreviewController, TrackingBotController, TrackingController], providers: [TrackingService, TrackingBotService, BotTokenGuard] })
export class TrackingModule {}
