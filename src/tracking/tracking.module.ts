import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessService } from './tracking.access';
import { BotTokenGuard, TrackingBotController, TrackingBotService } from './tracking.bot';
import { TrackingController, TrackingPreviewController } from './tracking.controller';
import { AdminController, GroupsController, GroupsService, InvitesController, ProfilesController } from './tracking.groups';
import { TrackingService } from './tracking.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [TrackingPreviewController, TrackingBotController, GroupsController, ProfilesController, InvitesController, AdminController, TrackingController],
  providers: [AccessService, TrackingService, GroupsService, TrackingBotService, BotTokenGuard],
})
export class TrackingModule {}
