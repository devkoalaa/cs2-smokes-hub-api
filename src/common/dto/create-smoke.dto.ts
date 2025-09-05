import { IsString, IsUrl, IsNumber, IsPositive, Length, IsInt } from 'class-validator';

export class CreateSmokeDto {
  @IsString()
  @Length(1, 100, { message: 'Title must be between 1 and 100 characters' })
  title: string;

  @IsUrl({}, { message: 'Video URL must be a valid URL' })
  videoUrl: string;

  @IsNumber({}, { message: 'Timestamp must be a number' })
  @IsPositive({ message: 'Timestamp must be a positive number' })
  @IsInt({ message: 'Timestamp must be an integer' })
  timestamp: number;

  @IsNumber({}, { message: 'X coordinate must be a number' })
  x_coord: number;

  @IsNumber({}, { message: 'Y coordinate must be a number' })
  y_coord: number;

  @IsNumber({}, { message: 'Map ID must be a number' })
  @IsPositive({ message: 'Map ID must be a positive number' })
  @IsInt({ message: 'Map ID must be an integer' })
  mapId: number;
}