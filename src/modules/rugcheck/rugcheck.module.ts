import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { RugcheckService } from './rugcheck.service';
import {
  TokenReport,
  TokenReportSchema,
} from '../../schemas/token-report.schema';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    MongooseModule.forFeature([
      { name: TokenReport.name, schema: TokenReportSchema },
    ]),
  ],
  providers: [RugcheckService],
  exports: [RugcheckService],
})
export class RugcheckModule {}
