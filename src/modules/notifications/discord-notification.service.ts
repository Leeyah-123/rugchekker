import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Client, EmbedBuilder } from 'discord.js';
import { TokenReportEvent } from './payloads/token-report-event.payload';

@Injectable()
export class DiscordNotificationService {
  private readonly logger = new Logger(DiscordNotificationService.name);
  private readonly client: Client;

  constructor(private readonly config: ConfigService) {
    this.client = new Client({
      intents: [],
    });

    const token = this.config.getOrThrow<string>('DISCORD_BOT_TOKEN');
    this.client.login(token).catch((err) => this.logger.error(err));
  }

  @OnEvent('token-reported.discord')
  async handleTokenReported(payload: TokenReportEvent) {
    try {
      const { watchers, report, type } = payload;

      const embed = new EmbedBuilder()
        .setTitle(`🚨 New ${type === 'token' ? 'Token' : 'Creator'} Report`)
        .setDescription(
          `A ${type === 'token' ? 'token' : 'creator'} you're watching has been reported for suspicious activity.`,
        )
        .addFields(
          {
            name: 'Token',
            value: report.mint,
            inline: true,
          },
          {
            name: 'Creator',
            value: report.creator,
            inline: true,
          },
          {
            name: 'Reason',
            value: report.message,
          },
          {
            name: 'Timestamp',
            value: new Date(report.createdAt).toLocaleString(),
            inline: true,
          },
        )
        .setColor(0xff0000)
        .setTimestamp();

      if (report.evidence) {
        embed.addFields({
          name: 'Evidence',
          value: `[View Evidence](${report.evidence})`,
        });
      }

      // Send notification to each watcher
      for (const watcher of watchers) {
        try {
          const user = await this.client.users.fetch(watcher.userId);
          await user.send({ embeds: [embed] });
        } catch (error) {
          this.logger.error(
            `Failed to send notification to Discord user ${watcher.userId}`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error handling Discord notification', error);
    }
  }
}
