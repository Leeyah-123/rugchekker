import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TokenReport,
  TokenReportSchema,
} from '../../schemas/token-report.schema';
import {
  WatchSubscription,
  WatchSubscriptionSchema,
} from '../../schemas/watch-subscription.schema';
import { ReportService } from '../report/report.service';
import { WatchService } from '../watch/watch.service';
import { RugcheckService } from './rugcheck.service';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: TokenReport.name, schema: TokenReportSchema },
      { name: WatchSubscription.name, schema: WatchSubscriptionSchema },
    ]),
  ],
  providers: [RugcheckService, WatchService, ReportService],
  exports: [RugcheckService, WatchService, ReportService],
})
export class RugcheckModule {}
