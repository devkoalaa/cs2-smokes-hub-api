import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

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

export class PreferencesDto {
  @IsBoolean()
  allowPreview: boolean;
}

export class AccessInviteDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(20)
  uses: number = 1;
}

export class PeriodDto {
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([0, 7, 30, 90])
  days: number = 30;
}
