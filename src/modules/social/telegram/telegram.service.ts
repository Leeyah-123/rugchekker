import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VybeService } from 'src/modules/vybe/vybe.service';
import { Context, Telegraf } from 'telegraf';
import { AiService } from '../../ai/ai.service';
import { GraphService } from '../../graph/graph.service';
import { RugcheckService } from '../../rugcheck/rugcheck.service';
import { BasePlatformService } from '../base/base.service';
import { TelegramCommands } from './commands/telegram.commands';

@Injectable()
export class TelegramService
  extends BasePlatformService
  implements OnModuleDestroy
{
  private readonly bot: Telegraf<Context>;
  private readonly commands: TelegramCommands;

  constructor(
    private readonly config: ConfigService,
    private readonly aiService: AiService,
    private readonly rugcheckService: RugcheckService,
    private readonly birdeyeService: VybeService,
    private readonly graphService: GraphService,
  ) {
    super();

    const token = this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');

    // Initialize Telegraf bot for polling
    this.bot = new Telegraf(token);

    // Register command handlers
    this.bot.start((ctx) =>
      ctx.reply('Welcome! Use /analyze <token> to get a risk report.', {
        reply_parameters: {
          message_id: ctx.message.message_id,
          chat_id: ctx.message.chat.id,
        },
      }),
    );

    this.commands = new TelegramCommands(
      this.bot,
      this.config,
      this.aiService,
      this.rugcheckService,
      this.birdeyeService,
      this.graphService,
    );

    this.bot.command('help', (ctx) => this.commands.handleHelpCommand(ctx));

    this.bot.command('analyze', (ctx) =>
      this.commands.handleAnalyzeCommand(ctx),
    );
    this.bot.action(/^analyze_token:(.+)$/, (ctx) =>
      this.commands.handleAnalyzeCommand(ctx),
    );

    this.bot.command('report', (ctx) => this.commands.handleReportCommand(ctx));
    this.bot.action(/^report_token:(.+)$/, (ctx) =>
      this.commands.handleReportCommand(ctx),
    );

    this.bot.command('new_tokens', (ctx) =>
      this.commands.handleNewTokensCommand(ctx),
    );
    this.bot.command('recent', (ctx) => this.commands.handleRecentCommand(ctx));
    this.bot.command('trending', (ctx) =>
      this.commands.handleTrendingCommand(ctx),
    );
    this.bot.command('verified', (ctx) =>
      this.commands.handleVerifiedCommand(ctx),
    );

    this.bot.command('creator', (ctx) =>
      this.commands.handleCreatorCommand(ctx),
    );
    this.bot.action(/^check_creator:(.+)$/, (ctx) =>
      this.commands.handleCreatorCommand(ctx),
    );

    this.bot.command('insiders', (ctx) =>
      this.commands.handleInsidersCommand(ctx),
    );
    this.bot.command('analyze_network', (ctx) =>
      this.commands.handleAnalyzeNetworkCommand(ctx),
    );

    // Add photo message handler
    this.bot.on('photo', (ctx) => {
      const caption = ctx.message?.caption;
      if (caption?.startsWith('/report')) {
        return this.commands.handleReportCommand(ctx);
      }
    });

    // Catch-all handler for unrecognized commands
    this.bot.on('text', (ctx) => {
      const messageText = ctx.message.text;
      if (messageText.startsWith('/')) {
        return ctx.reply(
          'Unrecognized command. Use /help to see available commands.',
          {
            reply_parameters: {
              message_id: ctx.message.message_id,
              chat_id: ctx.message.chat.id,
            },
          },
        );
      }
    });

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

  onModuleDestroy(): void {
    this.bot.stop();
    this.logger.log('Telegram bot stopped');
  }
}
