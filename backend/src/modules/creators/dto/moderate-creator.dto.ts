import { IsOptional, IsString, Length } from 'class-validator';

/** Тело `POST admin/creators/:id/suspend` — `reason` попадает в
 * `CreatorProfile.suspendedReason`, тот же приём, что `BanAdvertiserDto`
 * (`modules/advertising`). */
export class SuspendCreatorDto {
  @IsOptional()
  @IsString()
  @Length(0, 500, { message: 'Причина не должна превышать 500 символов' })
  reason?: string;
}
