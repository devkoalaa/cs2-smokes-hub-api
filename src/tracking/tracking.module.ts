import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessService } from './tracking.access';
import { BotTokenGuard, TrackingBotController, TrackingBotService } from './tracking.bot';
import { TrackingController, TrackingPreviewController } from './tracking.controller';
import { AdminController, GroupsController, GroupsService, InvitesController, ProfilesController } from './tracking.groups';
import { BotDiscordController, ImagesController, MediaController, MediaService } from './tracking.media';
import { TrackingService } from './tracking.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [TrackingPreviewController, ImagesController, BotDiscordController, TrackingBotController, MediaController, GroupsController, ProfilesController, InvitesController, AdminController, TrackingController],
  providers: [AccessService, MediaService, TrackingService, GroupsService, TrackingBotService, BotTokenGuard],
})
export class TrackingModule {}
