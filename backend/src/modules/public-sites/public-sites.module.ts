import { Module } from '@nestjs/common';
import { AnalyticsModule } from '@/modules/analytics/analytics.module';
import { AppointmentsModule } from '@/modules/appointments/appointments.module';
import { BlogPostsModule } from '@/modules/blog-posts/blog-posts.module';
import { DiscountsModule } from '@/modules/discounts/discounts.module';
import { DomainsModule } from '@/modules/domains/domains.module';
import { FormSubmissionsModule } from '@/modules/form-submissions/form-submissions.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { ProductsModule } from '@/modules/products/products.module';
import { RulesModule } from '@/modules/rules/rules.module';
import { ServicesModule } from '@/modules/services/services.module';
import { WebsitesModule } from '@/modules/websites/websites.module';
import { PublicSitesController } from './public-sites.controller';

@Module({
  imports: [
    DomainsModule,
    WebsitesModule,
    ProductsModule,
    OrdersModule,
    ServicesModule,
    AppointmentsModule,
    BlogPostsModule,
    FormSubmissionsModule,
    AnalyticsModule,
    DiscountsModule,
    RulesModule,
  ],
  controllers: [PublicSitesController],
})
export class PublicSitesModule {}
