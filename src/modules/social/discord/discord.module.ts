import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphModule } from 'src/modules/graph/graph.module';
import { AiModule } from '../../ai/ai.module';
import { RugcheckModule } from '../../rugcheck/rugcheck.module';
import { DiscordService } from './discord.service';

@Module({
  imports: [ConfigModule, AiModule, RugcheckModule, GraphModule],
  providers: [DiscordService],
  controllers: [],
})
export class DiscordModule implements OnModuleInit {
  constructor(private readonly discordService: DiscordService) {}

  onModuleInit() {
    this.discordService.initializeClient();
  }
}
