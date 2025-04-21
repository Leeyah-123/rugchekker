import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from '../../ai/ai.module';
import { RugcheckModule } from '../../rugcheck/rugcheck.module';
import { DiscordController } from './discord.controller';
import { DiscordService } from './discord.service';

@Module({
  imports: [ConfigModule, AiModule, RugcheckModule],
  providers: [DiscordService],
  controllers: [DiscordController],
})
export class DiscordModule implements OnModuleInit {
  constructor(private readonly discordService: DiscordService) {}

  onModuleInit() {
    this.discordService.initializeClient();
  }
}
