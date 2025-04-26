import { Module, OnModuleInit } from '@nestjs/common';
import { GraphModule } from 'src/modules/graph/graph.module';
import { VybeModule } from 'src/modules/vybe/vybe.module';
import { AiModule } from '../../ai/ai.module';
import { RugcheckModule } from '../../rugcheck/rugcheck.module';
import { DiscordService } from './discord.service';

@Module({
  imports: [AiModule, RugcheckModule, VybeModule, GraphModule],
  providers: [DiscordService],
  controllers: [],
})
export class DiscordModule implements OnModuleInit {
  constructor(private readonly discordService: DiscordService) {}

  onModuleInit() {
    this.discordService.initializeClient();
  }
}
