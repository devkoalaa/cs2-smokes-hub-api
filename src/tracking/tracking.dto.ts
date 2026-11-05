import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

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

  @IsOptional() @IsIn(['all', 'together'])
  scope: string = 'all';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000)
  page: number = 1;
}
