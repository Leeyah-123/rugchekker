import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { escapeMarkdown, truncateAddress } from 'src/shared/utils';
import { Context, Telegraf } from 'telegraf';
import { Message, ReplyParameters } from 'telegraf/typings/core/types/typegram';
import { AiService } from '../../ai/ai.service';
import { GraphService } from '../../graph/graph.service';
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

    this.bot.command('help', (ctx) => this.handleHelpCommand(ctx));

    // Add analyze command and callback handler
    this.bot.command('analyze', (ctx) => this.handleAnalyze(ctx));
    this.bot.action(/^analyze_token:(.+)$/, (ctx) => this.handleAnalyze(ctx));

    // Add report command and callback handler
    this.bot.command('report', (ctx) => this.handleReport(ctx));
    this.bot.action(/^report_token:(.+)$/, (ctx) => this.handleReport(ctx));

    this.bot.command('new_tokens', (ctx) => this.handleNewTokens(ctx));
    this.bot.command('recent', (ctx) => this.handleRecent(ctx));
    this.bot.command('trending', (ctx) => this.handleTrending(ctx));
    this.bot.command('verified', (ctx) => this.handleVerified(ctx));

    // Add creator command and callback handler
    this.bot.command('creator', (ctx) => this.handleCheckCreatorCommand(ctx));
    this.bot.action(/^check_creator:(.+)$/, (ctx) =>
      this.handleCheckCreatorCommand(ctx),
    );

    // Add insiders command
    this.bot.command('insiders', (ctx) => this.handleInsidersCommand(ctx));

    // Add photo message handler
    this.bot.on('photo', (ctx) => {
      const caption = ctx.message?.caption;
      if (caption?.startsWith('/report')) {
        return this.handleReport(ctx);
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

  private async handleAnalyze(ctx: Context) {
    const loading = new LoadingMessage(ctx);
    try {
      let mintAddress = '';
      let replyParams: ReplyParameters | undefined;

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
        mintAddress = msg.replace(/\/analyze\s*/, '');
        replyParams = {
          message_id: ctx.message.message_id,
          chat_id: ctx.message.chat.id,
        };
      }

      if (!mintAddress) {
        return ctx.reply(
          'Invalid command. Usage: /analyze <token>\nExample: /analyze JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        );
      }

      await loading.start('Analyzing token security');

      const report = await this.rugcheckService.getTokenReport(mintAddress);
      const aiInsights = await this.aiService.analyzeTokenRisks(report);
      await loading.stop();

      const { caption, continuation, reply_markup } = formatTelegramReport(
        mintAddress,
        report,
        aiInsights,
      );

      // Send main message with photo and (1/N) if there are continuations
      await ctx.replyWithPhoto(report.fileMeta?.image, {
        caption: continuation?.length
          ? `${caption}\n\n\\(1/${continuation.length + 1}\\)`
          : caption,
        parse_mode: 'MarkdownV2',
        reply_markup,
        reply_parameters: replyParams,
      });

      // Send continuation messages if any
      if (continuation?.length) {
        for (let i = 0; i < continuation.length; i++) {
          await ctx.reply(
            `${continuation[i]}\n\n\\(${i + 2}/${continuation.length + 1}\\)`,
            {
              parse_mode: 'MarkdownV2',
              reply_parameters: replyParams,
            },
          );
        }
      }
    } catch (err) {
      await loading.stop();
      this.logger.error('Error processing analyze command/callback', err);
      return ctx.reply('An error occurred while processing your request.', {
        reply_parameters: ctx.message
          ? {
              message_id: ctx.message.message_id,
              chat_id: ctx.message.chat.id,
            }
          : undefined,
      });
    }
  }

  private async getFileUrl(fileId: string): Promise<string> {
    try {
      const file = await this.bot.telegram.getFile(fileId);
      if (!file.file_path) {
        throw new Error('No file path returned');
      }
      const token = this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
      return `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    } catch (err) {
      this.logger.error('Error getting file URL', err);
      throw new Error('Failed to get file URL');
    }
  }

  private async handleReport(ctx: Context) {
    const loading = new LoadingMessage(ctx);
    try {
      // Handle report button click
      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        const mintAddress = ctx.callbackQuery.data.split(':')[1];
        await ctx.answerCbQuery('Preparing report command...');

        await ctx.reply(
          'Send your report in one of these formats:\n\n' +
            '1. Text message:\n/report <token> <message>\n\n' +
            '2. Photo with caption:\n/report <token> <message>\n\n' +
            'Token to report: ' +
            mintAddress,
          {
            parse_mode: 'MarkdownV2',
            reply_parameters: {
              message_id: ctx.callbackQuery.message.message_id,
              chat_id: ctx.callbackQuery.message.chat.id,
            },
          },
        );
        return;
      }

      // Handle report command
      if (!ctx.message) return;

      const msg = ctx.message as Message.PhotoMessage | Message.TextMessage;
      let mintAddress = '';
      let reportMessage = '';
      let evidence: string | undefined;

      await loading.start('Processing your report');

      // Extract command and content
      const messageText = 'photo' in msg ? msg.caption || '' : msg.text;
      if (!messageText.startsWith('/report')) {
        await loading.stop();
        return ctx.reply('Report must start with /report command', {
          reply_parameters: {
            message_id: msg.message_id,
            chat_id: msg.chat.id,
          },
        });
      }

      const parts = messageText.replace(/^\/report\s*/, '').split(' ');
      mintAddress = parts[0];
      reportMessage = parts.slice(1).join(' ');

      // Handle photo if present
      if ('photo' in msg && msg.photo.length > 0) {
        try {
          // Get the URL for the highest quality photo
          evidence = await this.getFileUrl(
            msg.photo[msg.photo.length - 1].file_id,
          );
        } catch (err) {
          this.logger.error('Error processing photo evidence', err);
          await loading.stop();
          return ctx.reply(
            'Failed to process the attached photo. Please try again.',
            {
              reply_parameters: {
                message_id: msg.message_id,
                chat_id: msg.chat.id,
              },
            },
          );
        }
      }

      if (!mintAddress || !reportMessage) {
        await loading.stop();
        return ctx.reply(
          'Invalid command. Usage: /report <token> <reason>\nExample: /report JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN Suspicious token movement',
          {
            reply_parameters: {
              message_id: msg.message_id,
              chat_id: msg.chat.id,
            },
          },
        );
      }

      const replyParams = {
        message_id: msg.message_id,
        chat_id: msg.chat.id,
      };

      // Get token info to get creator
      const tokenInfo = await this.rugcheckService.getTokenReport(mintAddress);

      const result = await this.rugcheckService.reportToken(mintAddress, {
        creator: tokenInfo.creator,
        reportedBy: ctx.from?.id.toString(),
        platform: 'telegram',
        message: reportMessage,
        evidence,
      });

      await loading.stop();
      return ctx.reply(result.message, { reply_parameters: replyParams });
    } catch (err) {
      await loading.stop();
      this.logger.error('Error processing report command/callback', err);
      return ctx.reply('An error occurred while reporting the token.', {
        reply_parameters: {
          message_id: ctx.message.message_id,
          chat_id: ctx.message.chat.id,
        },
      });
    }
  }

  private async handleHelpCommand(ctx: Context) {
    const helpMessage =
      '*🛡️ RugChekker \\- Solana Token Security Bot*\n\n' +
      'Welcome to RugChekker. Analyze and detect potential risks in Solana tokens before investing\\. ' +
      'Get detailed security reports, market metrics, and risk assessments for any token\\.\n\n' +
      '*📊 Available Commands:*\n' +
      '├ /analyze \\<token\\> \\- Get a detailed risk report\n' +
      '├ /report \\<token\\> \\<reason\\> [Attachment \\(optional\\)] \\- Report a suspicious token\n' +
      '├ /creator \\<address\\> \\- Get creator report\n' +
      '├ /insiders \\<token\\> [participants] \\- View insider trading network\n' +
      '├ /new\\_tokens \\- View recently created tokens\n' +
      '├ /recent \\- View most viewed tokens\n' +
      '├ /trending \\- View trending tokens\n' +
      '├ /verified \\- View verified tokens\n' +
      '└ /help \\- Display this help message\n\n' +
      '*🔍 Example Usage:*\n' +
      '/analyze JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN\n\n' +
      '_Stay safe with RugChekker_';

    return ctx.reply(helpMessage, {
      parse_mode: 'MarkdownV2',
      reply_parameters: {
        message_id: ctx.message.message_id,
        chat_id: ctx.message.chat.id,
      },
    });
  }

  private async handleNewTokens(ctx: Context) {
    const replyParams = {
      message_id: ctx.message.message_id,
      chat_id: ctx.message.chat.id,
    };

    try {
      const tokens = await this.rugcheckService.getNewTokens();
      const { text, reply_markup } = formatTokensList(
        '🆕 Recently Created Tokens',
        tokens,
      );
      return ctx.reply(text, {
        parse_mode: 'MarkdownV2',
        reply_markup,
        reply_parameters: replyParams,
      });
    } catch (err) {
      this.logger.error('Error fetching new tokens', err);
      return ctx.reply('An error occurred while fetching new tokens.', {
        reply_parameters: replyParams,
      });
    }
  }

  private async handleRecent(ctx: Context) {
    const replyParams = {
      message_id: ctx.message.message_id,
      chat_id: ctx.message.chat.id,
    };

    try {
      const tokens = await this.rugcheckService.getRecentTokens();
      const { text, reply_markup } = formatTokensList(
        '👀 Most Viewed Tokens',
        tokens,
      );
      return ctx.reply(text, {
        parse_mode: 'MarkdownV2',
        reply_markup,
        reply_parameters: replyParams,
      });
    } catch (err) {
      this.logger.error('Error fetching recent tokens', err);
      return ctx.reply('An error occurred while fetching recent tokens.', {
        reply_parameters: replyParams,
      });
    }
  }

  private async handleTrending(ctx: Context) {
    const replyParams = {
      message_id: ctx.message.message_id,
      chat_id: ctx.message.chat.id,
    };

    try {
      const tokens = await this.rugcheckService.getTrendingTokens();
      const { text, reply_markup } = formatTokensList(
        '🔥 Trending Tokens',
        tokens,
      );
      return ctx.reply(text, {
        parse_mode: 'MarkdownV2',
        reply_markup,
        reply_parameters: replyParams,
      });
    } catch (err) {
      this.logger.error('Error fetching trending tokens', err);
      return ctx.reply('An error occurred while fetching trending tokens.', {
        reply_parameters: replyParams,
      });
    }
  }

  private async handleVerified(ctx: Context) {
    const replyParams = {
      message_id: ctx.message.message_id,
      chat_id: ctx.message.chat.id,
    };

    try {
      const tokens = await this.rugcheckService.getVerifiedTokens();
      const { text, reply_markup } = formatTokensList(
        '✅ Recently Verified Tokens',
        tokens,
      );
      return ctx.reply(text, {
        parse_mode: 'MarkdownV2',
        reply_markup,
        reply_parameters: replyParams,
      });
    } catch (err) {
      this.logger.error('Error fetching verified tokens', err);
      return ctx.reply('An error occurred while fetching verified tokens.', {
        reply_parameters: replyParams,
      });
    }
  }

  private async handleCheckCreatorCommand(ctx: Context) {
    try {
      let address = '';
      let replyParams: ReplyParameters | undefined;

      // Handle both command and callback contexts
      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        address = ctx.callbackQuery.data.split(':')[1];
        replyParams = {
          message_id: ctx.callbackQuery.message.message_id,
          chat_id: ctx.callbackQuery.message.chat.id,
        };

        if (!address || address === 'unknown') {
          return ctx.reply('Token creator is unknown', {
            reply_parameters: replyParams,
          });
        }

        await ctx.answerCbQuery('Analyzing creator...');
      } else if (ctx.message && 'text' in ctx.message) {
        const msg = ctx.message.text;
        address = msg.replace(/\/creator\s*/, '');
        replyParams = {
          message_id: ctx.message.message_id,
          chat_id: ctx.message.chat.id,
        };
      }

      if (!address) {
        return ctx.reply(
          'Invalid command. Usage: /creator <address>\nExample: /creator 7WNRFqMpvqXGi6ytz36fS9tWzNh4ptpkCzASREDBBYoi',
          {
            reply_parameters: replyParams,
          },
        );
      }

      const report = await this.rugcheckService.getCreatorReport(address);
      const messageText =
        `*👤 Creator Report for* \`${address}\`\n\n` +
        `Total Reports: ${report.totalReports}\n` +
        `Unique Tokens Reported: ${report.uniqueTokensReported}\n\n` +
        (report.reports.length > 0
          ? `*🚨 Recent Reports:*\n${report.reports
              .slice(0, 5)
              .map((r) => {
                const evidenceLink = r.evidence
                  ? `\n  [View Evidence](${escapeMarkdown(r.evidence)})`
                  : '';
                return `• Token: \`${r.mint}\`\n  ${escapeMarkdown(r.message)}${evidenceLink}`;
              })
              .join('\n\n')}`
          : 'No reports found for this creator');

      return ctx.reply(messageText, {
        parse_mode: 'MarkdownV2',
        reply_parameters: replyParams,
        link_preview_options: {
          is_disabled: true,
        },
      });
    } catch (err) {
      this.logger.error('Error processing creator command/callback', err);
      return ctx.reply('An error occurred while fetching creator report.', {
        reply_parameters: {
          message_id: ctx.message.message_id,
          chat_id: ctx.message.chat.id,
        },
      });
    }
  }

  private async handleInsidersCommand(ctx: Context) {
    const loading = new LoadingMessage(ctx);
    const replyParams = {
      message_id: ctx.message.message_id,
      chat_id: ctx.message.chat.id,
    };

    try {
      const parts = ('text' in ctx.message ? ctx.message.text : '')
        .replace(/^\/insiders\s*/, '')
        .split(' ');

      const mintAddress = parts[0];
      const participantsOnly = parts[1]?.toLowerCase() === 'participants';

      if (!mintAddress) {
        return ctx.reply(
          'Invalid command. Usage:\n' +
            '/insiders <token> [participants]\n\n' +
            'Examples:\n' +
            '/insiders JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN\n' +
            '/insiders JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN participants',
          {
            reply_parameters: replyParams,
          },
        );
      }

      await loading.start('Generating insiders graph');

      const graphData =
        await this.rugcheckService.getInsidersGraph(mintAddress);
      if (!graphData || graphData.length === 0) {
        await loading.stop();
        return ctx.reply('No insider trading data found for this token\\.', {
          reply_parameters: replyParams,
        });
      }

      const imageBuffer = await this.graphService.generateInsidersGraph(
        graphData,
        participantsOnly,
      );

      await loading.stop();

      const caption = [
        '*Insider Trade Network Analysis*',
        `Mode: ${participantsOnly ? 'Participants Only' : 'All Accounts'}`,
        '\n',
        '*🔝 Top Insider Holders:*',
        ...graphData
          .flatMap((item) => item.nodes)
          .filter((n) => n.holdings > 0)
          .sort((a, b) => b.holdings - a.holdings)
          .slice(0, 10)
          .map((n) =>
            escapeMarkdown(
              `[${truncateAddress(n.id, 4, 4)}](${escapeMarkdown(`https://solscan.io/account/${n.id}`)}): ${n.holdings}`,
            ),
          ),
      ].join('\n');

      return ctx.replyWithPhoto(
        { source: imageBuffer },
        {
          caption,
          parse_mode: 'MarkdownV2',
          reply_parameters: replyParams,
        },
      );
    } catch (err) {
      await loading.stop();
      this.logger.error('Error generating insiders graph', err);
      return ctx.reply(
        'An error occurred while generating the insiders graph.',
        {
          reply_parameters: replyParams,
        },
      );
    }
  }

  onModuleDestroy(): void {
    this.bot.stop();
    this.logger.log('Telegram bot stopped');
  }
}
