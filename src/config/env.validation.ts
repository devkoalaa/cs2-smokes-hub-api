import { IsString, IsNotEmpty, IsOptional, IsPort } from 'class-validator';
import { Transform } from 'class-transformer';

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  STEAM_API_KEY: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  PORT?: number;
}