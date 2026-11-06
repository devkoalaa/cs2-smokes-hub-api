import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export const SHARE_CODE = /^CSGO-(?:[A-Za-z0-9]{5}-){4}[A-Za-z0-9]{5}$/;

export class ConfigureTrackingDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Matches(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{5}-[A-Za-z0-9]{4}$/)
  authCode: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Matches(SHARE_CODE)
  shareCode: string;
}

export class MatchQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 7, 30, 90])
  days: number = 30;

  @IsOptional() @IsString() @MaxLength(64) @Matches(/^[a-zA-Z0-9_/-]+$/)
  map?: string;

  @IsOptional() @IsIn(['all', 'competitive', 'wingman'])
  mode: string = 'all';

  @IsOptional() @IsIn(['all', 'together'])
  scope: string = 'all';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000)
  page: number = 1;

  // Grupo usado na comparação e no filtro "com o grupo no mesmo time".
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  group?: number;
}

export class GroupNameDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value)
  @IsString() @MinLength(2) @MaxLength(40)
  name: string;
}

/** Mapas que têm arte oficial no site (public/images/maps/art). */
export const BANNER_MAPS = ['de_ancient', 'de_anubis', 'de_dust2', 'de_inferno', 'de_mirage', 'de_nuke', 'de_overpass', 'de_train', 'de_vertigo'];

export class PreferencesDto {
  @IsOptional() @IsBoolean()
  allowPreview?: boolean;

  /** null volta ao padrão (o mapa mais jogado). */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsIn(BANNER_MAPS)
  bannerMap?: string | null;

  @IsOptional() @IsBoolean()
  discordDm?: boolean;
}

export class DiscordLinkDto {
  @IsString() @Matches(/^[A-Z2-9]{8}$/)
  code: string;

  @IsString() @Matches(/^\d{17,20}$/)
  discordId: string;

  @IsString() @MinLength(1) @MaxLength(64)
  discordName: string;
}

export class AccessInviteDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(20)
  uses: number = 1;
}

export class PeriodDto {
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 7, 30, 90])
  days: number = 30;
}
