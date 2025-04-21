import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from '../../ai/ai.module';
import { RugcheckModule } from '../../rugcheck/rugcheck.module';
import { DiscordService } from './discord.service';

@Module({
  imports: [ConfigModule, AiModule, RugcheckModule],
  providers: [DiscordService],
  controllers: [],
})
export class DiscordModule implements OnModuleInit {
  constructor(private readonly discordService: DiscordService) {}

  onModuleInit() {
    this.discordService.initializeClient();
  }
}
