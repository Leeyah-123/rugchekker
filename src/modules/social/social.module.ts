import { Module } from '@nestjs/common';
import { DiscordModule } from './discord/discord.module';
import { TelegramModule } from './telegram/telegram.module';
import { TwitterModule } from './twitter/twitter.module';

@Module({
  imports: [TwitterModule, DiscordModule, TelegramModule],
})
export class SocialModule {}
