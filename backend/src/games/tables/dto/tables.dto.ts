import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { GameType } from '@prisma/client';

export class CreateTableDto {
  @IsEnum(GameType)
  type!: GameType;

  @IsString()
  @MaxLength(40)
  name!: string;

  @IsInt()
  @Min(1)
  minBet!: number;

  @IsInt()
  @Min(2)
  @Max(1_000_000)
  maxBet!: number;

  @IsInt()
  @Min(2)
  @Max(9)
  maxSeats!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  smallBlind?: number;
}
