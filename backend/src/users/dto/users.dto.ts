import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}
