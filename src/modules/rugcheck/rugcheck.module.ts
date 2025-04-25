import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TokenReport,
  TokenReportSchema,
} from '../../schemas/token-report.schema';
import { RugcheckService } from './rugcheck.service';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: TokenReport.name, schema: TokenReportSchema },
    ]),
  ],
  providers: [RugcheckService],
  exports: [RugcheckService],
})
export class RugcheckModule {}
