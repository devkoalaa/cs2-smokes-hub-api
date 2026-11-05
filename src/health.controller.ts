import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
@Controller('healthz')
export class HealthController {
  constructor(private readonly db: PrismaService) {}
  @Get() async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { ok: true, commit: process.env.GIT_COMMIT_SHA || 'local' };
  }
}
