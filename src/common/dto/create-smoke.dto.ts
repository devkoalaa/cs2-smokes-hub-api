import { IsString, IsUrl, IsNumber, IsPositive, Length, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSmokeDto {
  @ApiProperty({ description: 'Smoke title', minLength: 1, maxLength: 100, example: 'CT Smoke from T Spawn' })
  @IsString()
  @Length(1, 100, { message: 'Title must be between 1 and 100 characters' })
  title: string;

  @ApiProperty({ description: 'Demonstration video URL', example: 'https://youtu.be/dQw4w9WgXcQ' })
  @IsUrl({}, { message: 'Video URL must be a valid URL' })
  videoUrl: string;

  @ApiProperty({ description: 'Timestamp in seconds within the video', example: 42 })
  @IsNumber({}, { message: 'Timestamp must be a number' })
  @IsPositive({ message: 'Timestamp must be a positive number' })
  @IsInt({ message: 'Timestamp must be an integer' })
  timestamp: number;

  @ApiProperty({ description: 'X coordinate on the map image', example: 512 })
  @IsNumber({}, { message: 'X coordinate must be a number' })
  x_coord: number;

  @ApiProperty({ description: 'Y coordinate on the map image', example: 384 })
  @IsNumber({}, { message: 'Y coordinate must be a number' })
  y_coord: number;

  @ApiProperty({ description: 'Target map identifier', example: 1 })
  @IsNumber({}, { message: 'Map ID must be a number' })
  @IsPositive({ message: 'Map ID must be a positive number' })
  @IsInt({ message: 'Map ID must be an integer' })
  mapId: number;
}