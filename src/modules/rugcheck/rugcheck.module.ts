import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { RugcheckService } from './rugcheck.service';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [RugcheckService],
  exports: [RugcheckService],
})
export class RugcheckModule {}
