import { UserResponseDto } from './user-response.dto';
import { MapResponseDto } from './map-response.dto';

export class SmokeResponseDto {
  id: number;
  title: string;
  videoUrl: string;
  timestamp: number;
  x_coord: number;
  y_coord: number;
  score: number;
  createdAt: Date;
  updatedAt: Date;
  author: UserResponseDto;
  map: MapResponseDto;
}