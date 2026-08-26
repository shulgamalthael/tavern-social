export type DomainType = 'SYSTEM_SUBDOMAIN' | 'CUSTOM_DOMAIN';

/** `system` — сгенерированный сабдомен, всегда рабочий и всегда verified.
 * `pending` — CUSTOM_DOMAIN, DNS ещё не настроен/не проверен.
 * `verified` — CUSTOM_DOMAIN, проверка прошла. См. backend `DomainDto`,
 * `backend/src/modules/domains/domains.types.ts` — то же самое поле. */
export type DomainStatus = 'system' | 'verified' | 'pending';

export interface Domain {
  id: string;
  hostname: string;
  type: DomainType;
  isPrimary: boolean;
  isVerified: boolean;
  status: DomainStatus;
  createdAt: string;
}

export interface DnsInstruction {
  type: string;
  name: string;
  value: string;
  description: string;
}

export interface ConnectDomainResult {
  domain: Domain;
  instructions: DnsInstruction[];
}
