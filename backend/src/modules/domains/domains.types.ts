import type { DomainType } from '@prisma/client';

/** `status` — то же упрощение, что и `BusinessDto.status` (см. `businesses.
 * types.ts`): производное поле, не хранится в БД отдельно, собирается из
 * `type`/`isVerified`, чтобы frontend не дублировал эту логику у себя.
 * `pending` покрывает и «ещё не проверяли», и «проверили — не прошло»: для
 * MVP пользователю в обоих случаях нужно одно и то же действие — поправить
 * DNS и нажать «Проверить» ещё раз (см. корневой план задачи, раздел
 * «MVP verification»). */
export type DomainStatus = 'system' | 'verified' | 'pending';

export interface DomainDto {
  id: string;
  hostname: string;
  type: DomainType;
  isPrimary: boolean;
  isVerified: boolean;
  status: DomainStatus;
  createdAt: string;
}

export interface DnsInstructionDto {
  type: string;
  name: string;
  value: string;
  description: string;
}

export interface ConnectDomainResultDto {
  domain: DomainDto;
  instructions: DnsInstructionDto[];
}

export interface ResolvedSiteDto {
  businessId: string;
}
