import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { escapeMarkdown } from 'src/shared/utils';
import { Telegraf } from 'telegraf';
import { TokenReportEvent } from './payloads/token-report-event.payload';

@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);
  private readonly bot: Telegraf;

  constructor(private readonly config: ConfigService) {
    const token = this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    this.bot = new Telegraf(token);
  }

  @OnEvent('token-reported.telegram')
  async handleTokenReported(payload: TokenReportEvent) {
    try {
      const { watchers, report, type } = payload;

      const message = [
        `*🚨 New ${type === 'token' ? 'Token' : 'Creator'} Report*`,
        '',
        `A ${type === 'token' ? 'token' : 'creator'} you're watching has been reported for suspicious activity\\.`,
        '',
        `*Token:* \`${escapeMarkdown(report.mint)}\``,
        `*Creator:* \`${escapeMarkdown(report.creator)}\``,
        `*Reason:* ${escapeMarkdown(report.message)}`,
        `*Timestamp:* ${new Date(report.createdAt).toLocaleString()}`,
      ];

      if (report.evidence) {
        message.push(
          '',
          `*Evidence:* [View](${escapeMarkdown(report.evidence)})`,
        );
      }

      // Send notification to each watcher
      for (const watcher of watchers) {
        try {
          await this.bot.telegram.sendMessage(
            watcher.userId,
            message.join('\n'),
            {
              parse_mode: 'MarkdownV2',
            },
          );
        } catch (error) {
          this.logger.error(
            `Failed to send notification to Telegram user ${watcher.userId}`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error handling Telegram notification', error);
    }
  }
}
