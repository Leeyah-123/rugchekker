import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from '../../ai/ai.module';
import { RugcheckModule } from '../../rugcheck/rugcheck.module';
import { TelegramService } from './telegram.service';

@Module({
  imports: [
    ConfigModule,
    AiModule,
    RugcheckModule,
    // TelegrafModule.forRootAsync({
    //   imports: [ConfigModule],
    //   useFactory: (config: ConfigService) => ({
    //     token: config.get<string>('TELEGRAM_BOT_TOKEN'),
    //     handlerTimeout: 30_000,
    //     botName: 'RugChekker',
    //   }),
    //   inject: [ConfigService],
    // }),
  ],
  providers: [TelegramService],
})
export class TelegramModule implements OnModuleInit {
  constructor(private readonly telegramService: TelegramService) {}

  onModuleInit() {
    this.telegramService.initializeClient();
  }
}
