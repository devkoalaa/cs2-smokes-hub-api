import { IsString, IsUrl, IsNumber, IsPositive, Length, IsInt, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SmokeType {
  SMOKE = 'SMOKE',
  BANG = 'BANG',
  MOLOTOV = 'MOLOTOV',
  STRATEGY = 'STRATEGY',
}

export class CreateSmokeDto {
  @ApiProperty({ description: 'Smoke title', minLength: 1, maxLength: 100, example: 'CT Smoke from T Spawn' })
  @IsString()
  @Length(1, 100, { message: 'O título deve ter entre 1 e 100 caracteres' })
  title: string;

  @ApiProperty({ description: 'Demonstration video URL', example: 'https://youtu.be/dQw4w9WgXcQ' })
  @IsUrl({}, { message: 'A URL do vídeo deve ser uma URL válida' })
  videoUrl: string;

  @ApiProperty({ description: 'Timestamp in seconds within the video', example: 42 })
  @IsNumber({}, { message: 'O timestamp deve ser um número' })
  @IsPositive({ message: 'O timestamp deve ser um número positivo' })
  @IsInt({ message: 'O timestamp deve ser um número inteiro' })
  timestamp: number;

  @ApiProperty({ description: 'X coordinate on the map image', example: 512 })
  @IsNumber({}, { message: 'A coordenada X deve ser um número' })
  x_coord: number;

  @ApiProperty({ description: 'Y coordinate on the map image', example: 384 })
  @IsNumber({}, { message: 'A coordenada Y deve ser um número' })
  y_coord: number;

  @ApiProperty({ description: 'Target map identifier', example: 1 })
  @IsNumber({}, { message: 'O ID do mapa deve ser um número' })
  @IsPositive({ message: 'O ID do mapa deve ser um número positivo' })
  @IsInt({ message: 'O ID do mapa deve ser um número inteiro' })
  mapId: number;

  @ApiProperty({ 
    description: 'Type of smoke', 
    enum: SmokeType, 
    example: SmokeType.SMOKE,
    required: false 
  })
  @IsOptional()
  @IsEnum(SmokeType, { message: 'O tipo deve ser um dos: SMOKE, BANG, MOLOTOV, STRATEGY' })
  type?: SmokeType;

  @ApiProperty({ 
    description: 'Floor level for multi-floor maps (e.g., Nuke). Use "upper" or "lower"', 
    example: 'upper',
    required: false 
  })
  @IsOptional()
  @IsString()
  @IsEnum(['upper', 'lower'], { message: 'O andar deve ser "upper" ou "lower"' })
  floor?: string;
}
