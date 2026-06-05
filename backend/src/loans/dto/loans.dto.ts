import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
} from 'class-validator';

export class RequestBankLoanDto {
  @IsInt()
  @IsIn([500, 1000, 2500])
  amount!: number;
}

export class RepayDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;
}

export class ProposeP2PLoanDto {
  @IsString()
  borrowerUsername!: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  amount!: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  interestRate!: number; // percent over the whole duration

  @IsInt()
  @Min(1)
  @Max(365)
  durationDays!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  penaltyRate?: number;
}

export class NegotiateP2PLoanDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  interestRate?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays?: number;
}

export class SendGiftDto {
  @IsString()
  recipientUsername!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  message?: string;
}
