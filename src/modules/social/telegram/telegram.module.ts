import { Module, OnModuleInit } from '@nestjs/common';
import { GraphModule } from 'src/modules/graph/graph.module';
import { VybeModule } from 'src/modules/vybe/vybe.module';
import { AiModule } from '../../ai/ai.module';
import { RugcheckModule } from '../../rugcheck/rugcheck.module';
import { TelegramService } from './telegram.service';

@Module({
  imports: [AiModule, RugcheckModule, VybeModule, GraphModule],
  providers: [TelegramService],
})
export class TelegramModule implements OnModuleInit {
  constructor(private readonly telegramService: TelegramService) {}

  onModuleInit() {
    this.telegramService.initializeClient();
  }
}
