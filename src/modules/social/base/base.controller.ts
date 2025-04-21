import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { DiscordService } from '../discord/discord.service';
import { TelegramService } from '../telegram/telegram.service';
import { BasePlatformService } from './base.service';

@Controller('webhook')
export class BasePlatformController {
  private readonly platformServices: Record<string, BasePlatformService>;

  constructor(
    private readonly discordService: DiscordService,
    private readonly telegramService: TelegramService,
  ) {
    this.platformServices = {
      discord: this.discordService,
      telegram: this.telegramService,
    };
  }

  @Post(':platform')
  @HttpCode(200)
  async handleWebhook(
    @Param('platform') platform: string,
    @Body() payload: any,
  ): Promise<any> {
    const service = this.platformServices[platform];
    if (!service) {
      throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
    return service.onMessage(payload);
  }
}
