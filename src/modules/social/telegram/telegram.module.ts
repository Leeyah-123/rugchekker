import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphModule } from 'src/modules/graph/graph.module';
import { AiModule } from '../../ai/ai.module';
import { RugcheckModule } from '../../rugcheck/rugcheck.module';
import { TelegramService } from './telegram.service';

@Module({
  imports: [ConfigModule, AiModule, RugcheckModule, GraphModule],
  providers: [TelegramService],
})
export class TelegramModule implements OnModuleInit {
  constructor(private readonly telegramService: TelegramService) {}

  onModuleInit() {
    this.telegramService.initializeClient();
  }
}
