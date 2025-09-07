import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('count')
  async getUsersCount(): Promise<{ count: number }> {
    const count = await this.prisma.user.count();
    return { count };
  }
}


