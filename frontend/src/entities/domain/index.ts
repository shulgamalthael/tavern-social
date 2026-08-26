export { connectDomain } from './api/connect-domain';
export { deleteDomain } from './api/delete-domain';
export { getDomainInstructions } from './api/get-domain-instructions';
export { getDomains } from './api/get-domains';
export { setPrimaryDomain } from './api/set-primary-domain';
export { verifyDomain } from './api/verify-domain';
export type {
  ConnectDomainResult,
  DnsInstruction,
  Domain,
  DomainStatus,
  DomainType,
} from './model/types';
