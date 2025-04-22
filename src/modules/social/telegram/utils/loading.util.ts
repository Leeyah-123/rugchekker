import { Logger } from '@nestjs/common';
import { Context } from 'telegraf';

export class LoadingMessage {
  private message: any;
  private frameIndex = 0;
  private interval: NodeJS.Timeout;
  private baseText: string;
  private readonly logger = new Logger('LoadingMessage');
  private readonly frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  constructor(private readonly ctx: Context) {}

  async start(text: string): Promise<void> {
    this.baseText = text;
    this.message = await this.ctx.reply(`${this.frames[0]} ${this.baseText}`);

    this.interval = setInterval(async () => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      const newText = `${this.frames[this.frameIndex]} ${this.baseText}`;

      try {
        if (this.message?.text !== newText) {
          await this.ctx.telegram.editMessageText(
            this.message.chat.id,
            this.message.message_id,
            undefined,
            newText,
          );
        }
      } catch (error) {
        if (
          !error.message?.includes('message is not modified') &&
          !error.message?.includes('message to edit not found')
        ) {
          this.logger.error('Error updating loading message:', error);
        }
      }
    }, 100);
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
