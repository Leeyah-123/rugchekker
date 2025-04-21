import { Logger } from '@nestjs/common';
import { Context } from 'telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';

export class LoadingMessage {
  private message: Message.TextMessage | null = null;
  private interval: NodeJS.Timeout | null = null;
  private readonly logger = new Logger('LoadingMessage');
  private readonly emojis = ['🔄', '⏳', '📊', '🔎'];
  private emojiIndex = 0;

  constructor(private readonly ctx: Context) {}

  async start(initialText: string = 'Processing...'): Promise<void> {
    try {
      this.message = (await this.ctx.reply(
        `${this.emojis[0]} ${initialText}`,
      )) as Message.TextMessage;

      this.interval = setInterval(async () => {
        try {
          this.emojiIndex = (this.emojiIndex + 1) % this.emojis.length;
          await this.ctx.telegram.editMessageText(
            this.message!.chat.id,
            this.message!.message_id,
            undefined,
            `${this.emojis[this.emojiIndex]} ${initialText}`,
          );
        } catch (e) {
          this.logger.error('Failed to update loading message', e);
          // Ignore animation update errors
        }
      }, 1000);
    } catch (e) {
      this.logger.error('Failed to start loading message', e);
    }
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (this.message) {
      try {
        await this.ctx.telegram.deleteMessage(
          this.message.chat.id,
          this.message.message_id,
        );
      } catch (e) {
        this.logger.error('Failed to delete loading message', e);
      }
      this.message = null;
    }
  }
}
