export class MapResponseDto {
  id: number;
  name: string;
  description?: string;
  thumbnail: string;
  radar?: string;
  radarLower?: string; // Radar do andar inferior (para mapas como Nuke)
  isActive: boolean;
  smokesCount?: number;
}