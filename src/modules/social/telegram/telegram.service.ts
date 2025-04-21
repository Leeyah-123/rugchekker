import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Context, Telegraf } from 'telegraf';
import { ReplyParameters } from 'telegraf/typings/core/types/typegram';
import { AiService } from '../../ai/ai.service';
import { RugcheckService } from '../../rugcheck/rugcheck.service';
import { BasePlatformService } from '../base/base.service';
import { formatTelegramReport } from './handlers/message.handler';
import { formatTokensList } from './handlers/tokens-list.handler';
import { LoadingMessage } from './utils/loading.util';

@Injectable()
export class TelegramService
  extends BasePlatformService
  implements OnModuleDestroy
{
  private readonly bot: Telegraf<Context>;

  constructor(
    private readonly config: ConfigService,
    private readonly aiService: AiService,
    private readonly rugcheckService: RugcheckService,
  ) {
    super();

    const token = this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');

    // Initialize Telegraf bot for polling
    this.bot = new Telegraf(token);

    // Register command handlers
    this.bot.start((ctx) =>
      ctx.reply('Welcome! Use /check <token> to get a risk report.'),
    );
    this.bot.command('check', (ctx) => this.handleCheck(ctx));

    // Add callback query handlers for both report and check buttons
    this.bot.action(/^report_token:(.+)$/, (ctx) => this.handleReport(ctx));
    this.bot.action(/^check_token:(.+)$/, (ctx) => this.handleCheck(ctx));

    // Add report command and callback handler
    this.bot.command('report', (ctx) => this.handleReport(ctx));
    this.bot.action(/^report_token:(.+)$/, (ctx) => this.handleReport(ctx));

    this.bot.command('help', (ctx) => this.handleHelpCommand(ctx));

    this.bot.command('new_tokens', (ctx) => this.handleNewTokens(ctx));
    this.bot.command('recent', (ctx) => this.handleRecent(ctx));
    this.bot.command('trending', (ctx) => this.handleTrending(ctx));
    this.bot.command('verified', (ctx) => this.handleVerified(ctx));

    this.logger.log('Telegram bot launched (polling mode)');
  }

  /** Start long‑polling */
  initializeClient(): void {
    this.bot
      .launch()
      .then(() => this.logger.log('Telegram bot launched (polling mode)'))
      .catch((err) => this.logger.error('Failed to launch Telegram bot', err));
  }

  /** Not used in polling mode */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onMessage(_payload: any): Promise<any> {
    this.logger.warn('onMessage() called but this service is in polling mode');
  }

  private async handleCheck(ctx: Context) {
    const loading = new LoadingMessage(ctx);
    try {
      let mintAddress = '';
      let replyParams;

      // Handle both command and callback contexts
      if (
        ctx.callbackQuery &&
        'data' in ctx.callbackQuery &&
        ctx.callbackQuery.data
      ) {
        mintAddress = ctx.callbackQuery.data.split(':')[1];
        await ctx.answerCbQuery('Analyzing token...');
        replyParams = {
          message_id: ctx.callbackQuery.message.message_id,
          chat_id: ctx.callbackQuery.message.chat.id,
        };
      } else if (ctx.message && 'text' in ctx.message) {
        const msg = ctx.message.text;
        mintAddress = msg.replace(/\/check\s*/, '');
        replyParams = {
          message_id: ctx.message.message_id,
          chat_id: ctx.message.chat.id,
        };
      }

      if (!mintAddress) {
        return ctx.reply(
          'Invalid command. Usage: /check <token>\nExample: /check JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        );
      }

      await loading.start('Analyzing token security...');
      const report = await this.rugcheckService.getTokenReport(mintAddress);
      const aiInsights = await this.aiService.analyzeTokenRisks(report);
      await loading.stop();

      const { text, reply_markup } = formatTelegramReport(
        mintAddress,
        report,
        aiInsights,
      );

      return ctx.replyWithPhoto(report.fileMeta?.image, {
        caption: text,
        parse_mode: 'MarkdownV2',
        reply_markup,
        reply_parameters: replyParams,
      });
    } catch (err) {
      await loading.stop();
      this.logger.error('Error processing check command/callback', err);
      return ctx.reply('An error occurred while processing your request.');
    }
  }

  private async handleReport(ctx: Context) {
    try {
      let mintAddress = '';
      let replyParams: ReplyParameters;

      // Handle both command and callback
      if ('match' in ctx) {
        mintAddress = ctx.match[1];
        await ctx.answerCbQuery('Processing report...');
        replyParams = {
          message_id: ctx.callbackQuery.message.message_id,
          chat_id: ctx.callbackQuery.message.chat.id,
        };
      } else {
        const msg = (ctx.message as any)?.text || '';
        mintAddress = msg.replace(/\/report\s*/, '');
        replyParams = {
          message_id: ctx.message.message_id,
          chat_id: ctx.message.chat.id,
        };
      }

      if (!mintAddress) {
        return ctx.reply(
          'Invalid command. Usage: /report <token>\nExample: /report JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        );
      }

      const result = await this.rugcheckService.reportToken(mintAddress);
      return ctx.reply(result.message, { reply_parameters: replyParams });
    } catch (err) {
      this.logger.error('Error processing report command/callback', err);
      return ctx.reply('An error occurred while reporting the token.');
    }
  }

  private async handleHelpCommand(ctx: Context) {
    const helpMessage =
      '*🛡️ RugChekker \\- Solana Token Security Bot*\n\n' +
      'RugChekker helps you analyze and detect potential risks in Solana tokens before investing\\. ' +
      'Get detailed security reports, market metrics, and risk assessments for any token\\.\n\n' +
      '*📊 Available Commands:*\n' +
      '├ /check \\<token\\> \\- Get a detailed risk report\n' +
      '├ /report \\<token\\> \\- Report a suspicious token\n' +
      '└ /help \\- Display this help message\n\n' +
      '*🔍 Example Usage:*\n' +
      '/check JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN\n\n' +
      '_Stay safe with RugChekker_';

    return ctx.reply(helpMessage, { parse_mode: 'MarkdownV2' });
  }

  private async handleNewTokens(ctx: Context) {
    try {
      const tokens = await this.rugcheckService.getNewTokens();
      const { text, reply_markup } = formatTokensList(
        '🆕 Recently Created Tokens',
        tokens,
      );
      return ctx.reply(text, { parse_mode: 'MarkdownV2', reply_markup });
    } catch (err) {
      this.logger.error('Error fetching new tokens', err);
      return ctx.reply('An error occurred while fetching new tokens.');
    }
  }

  private async handleRecent(ctx: Context) {
    try {
      const tokens = await this.rugcheckService.getRecentTokens();
      const { text, reply_markup } = formatTokensList(
        '👀 Most Viewed Tokens',
        tokens,
      );
      return ctx.reply(text, { parse_mode: 'MarkdownV2', reply_markup });
    } catch (err) {
      this.logger.error('Error fetching recent tokens', err);
      return ctx.reply('An error occurred while fetching recent tokens.');
    }
  }

  private async handleTrending(ctx: Context) {
    try {
      const tokens = await this.rugcheckService.getTrendingTokens();
      const { text, reply_markup } = formatTokensList(
        '🔥 Trending Tokens',
        tokens,
      );
      return ctx.reply(text, { parse_mode: 'MarkdownV2', reply_markup });
    } catch (err) {
      this.logger.error('Error fetching trending tokens', err);
      return ctx.reply('An error occurred while fetching trending tokens.');
    }
  }

  private async handleVerified(ctx: Context) {
    try {
      const tokens = await this.rugcheckService.getVerifiedTokens();
      const { text, reply_markup } = formatTokensList(
        '✅ Recently Verified Tokens',
        tokens,
      );
      return ctx.reply(text, { parse_mode: 'MarkdownV2', reply_markup });
    } catch (err) {
      this.logger.error('Error fetching verified tokens', err);
      return ctx.reply('An error occurred while fetching verified tokens.');
    }
  }

  onModuleDestroy(): void {
    this.bot.stop();
    this.logger.log('Telegram bot stopped');
  }
}
