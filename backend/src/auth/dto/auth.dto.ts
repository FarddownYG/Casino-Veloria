import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username may only contain letters, numbers and underscores',
  })
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  referralCode?: string;
}

export class LoginDto {
  @IsString()
  emailOrUsername!: string;

  @IsString()
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class SupabaseLoginDto {
  @IsString()
  accessToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  referralCode?: string;
}
