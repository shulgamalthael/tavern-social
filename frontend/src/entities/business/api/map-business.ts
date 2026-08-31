import type {
  Business,
  BusinessCapability,
  BusinessCategory,
  BusinessStatus,
  SocialLink,
  TaxMode,
  WorkingHours,
} from '../model/types';

export interface BusinessResponse {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: BusinessCategory;
  logoUrl: string | null;
  faviconUrl: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  socialLinks: SocialLink[];
  seoTitle: string | null;
  seoDescription: string | null;
  capabilities: BusinessCapability[];
  currency: string;
  taxRateBps: number;
  taxMode: TaxMode;
  workingHours: WorkingHours | null;
  web3WalletAddress: string | null;
  hasOwnWeb3ApiKey: boolean;
  status: BusinessStatus;
  createdAt: string;
  updatedAt: string;
}

export function mapBusiness(response: BusinessResponse): Business {
  return { ...response };
}
