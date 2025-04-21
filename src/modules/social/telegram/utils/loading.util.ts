import { Logger } from '@nestjs/common';
import { Context } from 'telegraf';

export class LoadingMessage {
  private message: any;
  private dots = 0;
  private interval: NodeJS.Timeout;
  private baseText: string;
  private readonly logger = new Logger('LoadingMessage');

  constructor(private readonly ctx: Context) {}

  async start(text: string): Promise<void> {
    this.baseText = text;
    this.message = await this.ctx.reply(this.baseText);

    this.interval = setInterval(async () => {
      this.dots = (this.dots + 1) % 4;
      const newText = this.baseText + '.'.repeat(this.dots);

      try {
        // Only update if text has changed
        if (this.message?.text !== newText) {
          await this.ctx.telegram.editMessageText(
            this.message.chat.id,
            this.message.message_id,
            undefined,
            newText,
          );
        }
      } catch (error) {
        // Ignore edit conflicts
        if (
          !error.message?.includes('message is not modified') &&
          !error.message?.includes('message to edit not found')
        ) {
          this.logger.error('Error updating loading message:', error);
        }
      }
    }, 500);
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
    }

    try {
      if (this.message) {
        await this.ctx.telegram.deleteMessage(
          this.message.chat.id,
          this.message.message_id,
        );
        this.message = null;
      }
    } catch (error) {
      this.logger.error('Error cleaning up loading message:', error);
    }
  }
}
