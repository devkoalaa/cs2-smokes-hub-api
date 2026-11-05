import { TrackingModule } from './tracking/tracking.module';
import { HealthController } from './health.controller';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/throttler.guard';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MapsModule } from './maps/maps.module';
import { SmokesModule } from './smokes/smokes.module';
import { RatingsModule } from './ratings/ratings.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';
import { EnvironmentVariables } from './config/env.validation';
import { validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';

function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}

@Module({
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate,
    }),
    // Limite por IP (o Caddy informa o IP real; ver trust proxy no main.ts).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    MapsModule,
    SmokesModule,
    RatingsModule,
    ReportsModule,
    UsersModule,
    TrackingModule,
  ],
})
export class AppModule {}
