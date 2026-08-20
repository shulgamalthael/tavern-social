import { IsBoolean } from 'class-validator';

/** Соответствует тумблерам SETTINGS_TOGGLES на frontend (widgets/settings). */
export class UpdateSettingsDto {
  @IsBoolean()
  quietHours!: boolean;

  @IsBoolean()
  showPresence!: boolean;

  @IsBoolean()
  allowStrangerInvites!: boolean;

  @IsBoolean()
  morningDigest!: boolean;
}
