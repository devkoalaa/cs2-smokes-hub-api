import { IsNumber, IsIn } from 'class-validator';

export class RateSmokeDto {
  @IsNumber()
  @IsIn([1, -1], { message: 'Rating value must be either 1 or -1' })
  value: number;
}