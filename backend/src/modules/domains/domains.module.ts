import { Module } from '@nestjs/common';
import { DnsTxtDomainVerificationProvider } from './dns-txt-domain-verification.provider';
import { DomainResolverService } from './domain-resolver.service';
import { DomainVerificationProvider } from './domain-verification.provider';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';

@Module({
  controllers: [DomainsController],
  providers: [
    DomainsService,
    DomainResolverService,
    { provide: DomainVerificationProvider, useClass: DnsTxtDomainVerificationProvider },
  ],
  exports: [DomainsService, DomainResolverService],
})
export class DomainsModule {}
