import { UserResponseDto } from './user-response.dto';
import { MapResponseDto } from './map-response.dto';
import { SmokeType } from './create-smoke.dto';

export class SmokeResponseDto {
  id: number;
  title: string;
  videoUrl: string;
  timestamp: number;
  type: SmokeType;
  x_coord: number;
  y_coord: number;
  score: number;
  createdAt: Date;
  updatedAt: Date;
  author: UserResponseDto;
  map: MapResponseDto;
}

export { SmokeType };