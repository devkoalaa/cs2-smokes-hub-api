import { IsString, MinLength, MaxLength } from 'class-validator';

export class ReportSmokeDto {
  @IsString()
  @MinLength(10, { message: 'Reason must be at least 10 characters long' })
  @MaxLength(500, { message: 'Reason must not exceed 500 characters' })
  reason: string;
}