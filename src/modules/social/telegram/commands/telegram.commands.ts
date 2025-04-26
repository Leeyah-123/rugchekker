import { ConfigService } from '@nestjs/config';
import { ReportService } from 'src/modules/report/report.service';
import { VybeService } from 'src/modules/vybe/vybe.service';
import { WatchService } from 'src/modules/watch/watch.service';
import { SUPPORTED_OHLCV_DURATIONS } from 'src/shared/constants';
import { escapeMarkdown, truncateAddress } from 'src/shared/utils';
import { isValidSolanaAddress } from 'src/shared/utils/address.utils';
import { Context, Telegraf } from 'telegraf';
import { Message, ReplyParameters } from 'telegraf/typings/core/types/typegram';
import { AiService } from '../../../ai/ai.service';
import { GraphService } from '../../../graph/graph.service';
import { RugcheckService } from '../../../rugcheck/rugcheck.service';
import { BaseCommands } from '../../base/base.commands';
import { formatTelegramReport } from '../handlers/message.handler';
import { formatTokensList } from '../handlers/tokens-list.handler';
import { LoadingMessage } from '../utils/loading.util';

export class TelegramCommands extends BaseCommands {
  constructor(
    private readonly bot: Telegraf<Context>,
    private readonly config: ConfigService,
    private readonly aiService: AiService,
    private readonly rugcheckService: RugcheckService,
    private readonly vybeService: VybeService,
    private readonly graphService: GraphService,
    private readonly watchService: WatchService,
    private readonly reportService: ReportService,
  ) {
    super();
  }

  async handleAnalyzeCommand(ctx: Context) {
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
        mintAddress = msg.split(' ')[1];
        replyParams = {
          message_id: ctx.message.message_id,
          chat_id: ctx.message.chat.id,
        };
      }

      if (!mintAddress) {
        return ctx.reply(
          'Invalid command. Usage: /analyze <token>\nExample: /analyze JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
          {
            reply_parameters: replyParams,
          },
        );
      }
      if (!isValidSolanaAddress(mintAddress)) {
        return ctx.reply('Invalid address provided.', {
          reply_parameters: replyParams,
        });
      }

      await loading.start('Analyzing token security');

      const report = await this.rugcheckService.getTokenReport(mintAddress);
      if (typeof report === 'string') {
        await loading.stop();
        return ctx.reply(report, {
          reply_parameters: replyParams,
        });
      }

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
      this.handleCommandError(err, () => {
        this.logger.error('Error processing analyze command/callback', err);
        return ctx.reply('An error occurred while processing your request.', {
          reply_parameters: ctx.message
            ? {
                message_id: ctx.message.message_id,
                chat_id: ctx.message.chat.id,
              }
            : undefined,
        });
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

  async handleReportCommand(ctx: Context) {
    const loading = new LoadingMessage(ctx);
    let replyParams: ReplyParameters | undefined;

    try {
      // Handle report button click
      if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
        replyParams = {
          message_id: ctx.callbackQuery.message.message_id,
          chat_id: ctx.callbackQuery.message.chat.id,
        };

        const mintAddress = ctx.callbackQuery.data.split(':')[1];
        if (!isValidSolanaAddress(mintAddress)) {
          return ctx.reply('Invalid address provided.', {
            reply_parameters: replyParams,
          });
        }

        await ctx.answerCbQuery('Preparing report command...');

        await ctx.reply(
          'Send your report in one of these formats:\n\n' +
            '1. Text message:\n/report <token> <message>\n\n' +
            '2. Photo with caption:\n/report <token> <message>\n\n' +
            'Token to report: ' +
            mintAddress,
          {
            parse_mode: 'MarkdownV2',
            reply_parameters: replyParams,
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
      replyParams = {
        message_id: msg.message_id,
        chat_id: msg.chat.id,
      };

      await loading.start('Processing your report');

      // Extract command and content
      const messageText = 'photo' in msg ? msg.caption || '' : msg.text;
      if (!messageText.startsWith('/report')) {
        await loading.stop();
        return ctx.reply('Report must start with /report command', {
          reply_parameters: replyParams,
        });
      }

      const parts = messageText.split(' ');
      mintAddress = parts[1];
      reportMessage = parts.slice(2).join(' ');

      if (!mintAddress || !reportMessage) {
        await loading.stop();
        return ctx.reply(
          'Invalid command. Usage: /report <token> <reason>\nExample: /report JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN Suspicious token movement',
          {
            reply_parameters: replyParams,
          },
        );
      }
      if (!isValidSolanaAddress(mintAddress)) {
        await loading.stop();
        return ctx.reply('Invalid token address provided', {
          reply_parameters: replyParams,
        });
      }

      // Get token info to get creator
      const tokenInfo = await this.rugcheckService.getTokenReport(mintAddress);
      if (typeof tokenInfo === 'string') {
        await loading.stop();
        return ctx.reply(tokenInfo, {
          reply_parameters: replyParams,
        });
      }

      const result = await this.reportService.reportToken(mintAddress, {
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
      this.handleCommandError(err, () => {
        this.logger.error('Error processing report command/callback', err);
        return ctx.reply('An error occurred while reporting the token.', {
          reply_parameters: {
            message_id: ctx.message.message_id,
            chat_id: ctx.message.chat.id,
          },
        });
      });
    }
  }

  async handleHelpCommand(ctx: Context) {
    const helpMessage = [
      '*🛡️ RugChekker \\- Solana Token Security Bot*',
      '',
      'Welcome to RugChekker\\. Analyze and detect potential risks in Solana tokens before investing\\.',
      'Get detailed security reports, market metrics, and risk assessments for any token\\.',
      '',
      '*📊 Available Commands:*',
      '`/analyze <token>` \\- Get a detailed risk report',
      '`/report <token> <reason> [Attachment (optional)]` \\- Report a suspicious token',
      '`/creator <address>` \\- Get creator report',
      '`/insiders <token> [participants]` \\- View insider trading network',
      '`/analyze\\_network <token> [duration]` \\- Analyze token network over time',
      `Supported durations: ${Object.entries(SUPPORTED_OHLCV_DURATIONS)
        .map(([key, value]) => `${key} \\(${value}\\)`)
        .join(', ')}`,
      '`/new\\_tokens` \\- View recently created tokens',
      '`/recent` \\- View most viewed tokens',
      '`/trending` \\- View trending tokens',
      '`/verified` \\- View verified tokens',
      '`/wc <address>` \\- Watch creator for reports',
      '`/uc <address>` \\- Unwatch creator',
      '`/wt <token>` \\- Watch token for reports',
      '`/ut <token>` \\- Unwatch token',
      '`/help` \\- Display this help message',
      '',
      '*🔍 Example Usage:*',
      '`/analyze JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN`',
      '',
      '_Stay safe with RugChekker_',
    ].join('\n');

    return ctx.reply(helpMessage, {
      parse_mode: 'MarkdownV2',
      reply_parameters: {
        message_id: ctx.message.message_id,
        chat_id: ctx.message.chat.id,
      },
    });
  }

  async handleNewTokensCommand(ctx: Context) {
    const loading = new LoadingMessage(ctx);
    const replyParams = {
      message_id: ctx.message.message_id,
      chat_id: ctx.message.chat.id,
    };

    try {
      await loading.start('Fetching newly created tokens');
      const tokens = await this.rugcheckService.getNewTokens();
      const { text, reply_markup } = formatTokensList(
        '🆕 Recently Created Tokens',
        tokens,
      );

      await loading.stop();
      return ctx.reply(text, {
        parse_mode: 'MarkdownV2',
        reply_markup,
        reply_parameters: replyParams,
      });
    } catch (err) {
      this.logger.error('Error fetching new tokens', err);
      await loading.stop();
      this.handleCommandError(err, () => {
        return ctx.reply('An error occurred while fetching new tokens.', {
          reply_parameters: replyParams,
        });
      });
    }
  }

  async handleRecentCommand(ctx: Context) {
    const loading = new LoadingMessage(ctx);
    const replyParams = {
      message_id: ctx.message.message_id,
      chat_id: ctx.message.chat.id,
    };

    try {
      await loading.start('Fetching recently viewed tokens');
      const tokens = await this.rugcheckService.getRecentTokens();
      const { text, reply_markup } = formatTokensList(
        '👀 Most Viewed Tokens',
        tokens,
      );

      await loading.stop();
      return ctx.reply(text, {
        parse_mode: 'MarkdownV2',
        reply_markup,
        reply_parameters: replyParams,
      });
    } catch (err) {
      this.logger.error('Error fetching recent tokens', err);
      await loading.stop();
      this.handleCommandError(err, () => {
        return ctx.reply('An error occurred while fetching recent tokens.', {
          reply_parameters: replyParams,
        });
      });
    }
  }

  async handleTrendingCommand(ctx: Context) {
    const loading = new LoadingMessage(ctx);
    const replyParams = {
      message_id: ctx.message.message_id,
      chat_id: ctx.message.chat.id,
    };

    try {
      await loading.start('Fetching trending tokens');
      const tokens = await this.rugcheckService.getTrendingTokens();
      const { text, reply_markup } = formatTokensList(
        '🔥 Trending Tokens',
        tokens,
      );
      await loading.stop();
      return ctx.reply(text, {
        parse_mode: 'MarkdownV2',
        reply_markup,
        reply_parameters: replyParams,
      });
    } catch (err) {
      this.logger.error('Error fetching trending tokens', err);
      await loading.stop();
      this.handleCommandError(err, () => {
        return ctx.reply('An error occurred while fetching trending tokens.', {
          reply_parameters: replyParams,
        });
      });
    }
  }

  async handleVerifiedCommand(ctx: Context) {
    const loading = new LoadingMessage(ctx);
    const replyParams = {
      message_id: ctx.message.message_id,
      chat_id: ctx.message.chat.id,
    };

    try {
      await loading.start('Fetching recently verified tokens');
      const tokens = await this.rugcheckService.getVerifiedTokens();
      const { text, reply_markup } = formatTokensList(
        '✅ Recently Verified Tokens',
        tokens,
      );
      await loading.stop();
      return ctx.reply(text, {
        parse_mode: 'MarkdownV2',
        reply_markup,
        reply_parameters: replyParams,
      });
    } catch (err) {
      this.logger.error('Error fetching verified tokens', err);
      await loading.stop();
      this.handleCommandError(err, () => {
        return ctx.reply('An error occurred while fetching verified tokens.', {
          reply_parameters: replyParams,
        });
      });
    }
  }

  async handleCreatorCommand(ctx: Context) {
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
        address = msg.split(' ')[1];
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
      if (!isValidSolanaAddress(address)) {
        return ctx.reply('Invalid address provided.', {
          reply_parameters: replyParams,
        });
      }

      const report = await this.reportService.getCreatorReport(address);
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
      this.handleCommandError(err, () => {
        return ctx.reply('An error occurred while fetching creator report.', {
          reply_parameters: {
            message_id: ctx.message.message_id,
            chat_id: ctx.message.chat.id,
          },
        });
      });
    }
  }

  async handleInsidersCommand(ctx: Context) {
    const loading = new LoadingMessage(ctx);
    const replyParams = {
      message_id: ctx.message.message_id,
      chat_id: ctx.message.chat.id,
    };

    try {
      const parts = ('text' in ctx.message ? ctx.message.text : '').split(' ');

      const mintAddress = parts[1];
      const participantsOnly = parts[2]?.toLowerCase() === 'participants';

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
      if (!isValidSolanaAddress(mintAddress)) {
        return ctx.reply('Invalid token address format.', {
          reply_parameters: replyParams,
        });
      }

      await loading.start('Generating insiders graph');

      const graphData =
        await this.rugcheckService.getInsidersGraph(mintAddress);
      if (typeof graphData === 'string') {
        await loading.stop();
        return ctx.reply(graphData, {
          reply_parameters: replyParams,
        });
      }

      if (!graphData || graphData.length === 0) {
        await loading.stop();
        return ctx.reply('No insider trading data found for this token\\.', {
          reply_parameters: replyParams,
        });
      }

      const imageBuffer = await this.graphService.generateInsidersGraph(
        graphData as any,
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
          .map(
            (n) =>
              `[${escapeMarkdown(truncateAddress(n.id, 4, 4))}](${`https://solscan\\.io/account/${escapeMarkdown(n.id)}`}): ${n.holdings}`,
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
      this.handleCommandError(err, () => {
        this.logger.error('Error generating insiders graph', err);
        return ctx.reply(
          'An error occurred while generating the insiders graph.',
          {
            reply_parameters: replyParams,
          },
        );
      });
    }
  }

  async handleAnalyzeNetworkCommand(ctx: Context) {
    const loading = new LoadingMessage(ctx);
    const replyParams = {
      message_id: ctx.message.message_id,
      chat_id: ctx.message.chat.id,
    };

    try {
      const parts = ('text' in ctx.message ? ctx.message.text : '').split(' ');

      const mintAddress = parts[1];
      const duration = parts[2] || '1d';

      if (!mintAddress) {
        const supportedDurations = Object.entries(SUPPORTED_OHLCV_DURATIONS)
          .map(([key, value]) => `${key} (${value})`)
          .join('\n');

        return ctx.reply(
          'Invalid command. Usage:\n' +
            '/analyze_network <token> [duration]\n\n' +
            'Examples:\n' +
            '/analyze_network JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN\n' +
            '/analyze_network JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN 1d\n\n' +
            'Supported durations:\n' +
            supportedDurations,
          {
            reply_parameters: replyParams,
          },
        );
      }

      if (!isValidSolanaAddress(mintAddress)) {
        return ctx.reply('Invalid token address provided.', {
          reply_parameters: replyParams,
        });
      }

      if (duration && !(duration in SUPPORTED_OHLCV_DURATIONS)) {
        return ctx.reply(
          'Invalid duration specified.\n' +
            'Supported durations:\n' +
            Object.entries(SUPPORTED_OHLCV_DURATIONS)
              .map(([key, value]) => `${key} (${value})`)
              .join(', '),
          {
            reply_parameters: replyParams,
          },
        );
      }

      await loading.start('Analyzing token network');

      const tokenInfo = await this.rugcheckService.getTokenReport(mintAddress);
      if (typeof tokenInfo === 'string') {
        await loading.stop();
        return ctx.reply(tokenInfo, { reply_parameters: replyParams });
      }

      const candlestickData = await this.vybeService.getTokenOHLCV(
        mintAddress,
        duration as any,
      );

      const [aiAnalysis, graphBuffer] = await Promise.all([
        this.aiService.analyzeCandlestickPattern(
          tokenInfo.tokenMeta.symbol,
          candlestickData.data,
          duration,
        ),
        this.graphService.generateCandlestickGraph(
          candlestickData.data,
          tokenInfo.tokenMeta.symbol,
          duration,
        ),
      ]);

      await loading.stop();

      const caption = [
        `*${escapeMarkdown(tokenInfo.tokenMeta.name)} \\(${escapeMarkdown(
          tokenInfo.tokenMeta.symbol,
        )}\\)*`,
        '',
        '*🔍 AI Network Analysis:*',
        escapeMarkdown(aiAnalysis),
        '',
        '*⚠️ Disclaimer:*',
        'This AI analysis is for informational purposes only and may or may not be accurate\\. Always conduct your own research \\(DYOR\\) before making any investment decisions\\.',
      ].join('\n');

      return ctx.replyWithPhoto(
        { source: graphBuffer },
        {
          caption,
          parse_mode: 'MarkdownV2',
          reply_parameters: replyParams,
        },
      );
    } catch (err) {
      await loading.stop();
      this.handleCommandError(err, () => {
        this.logger.error('Error analyzing network', err);
        return ctx.reply('An error occurred while analyzing the network.', {
          reply_parameters: replyParams,
        });
      });
    }
  }

  async handleWatchCreatorCommand(ctx: Context) {
    const parts = ('text' in ctx.message ? ctx.message.text : '').split(' ');

    const address = parts[1];
    const replyParams = {
      message_id: ctx.message.message_id,
      chat_id: ctx.message.chat.id,
    };

    if (!address || !isValidSolanaAddress(address)) {
      return ctx.reply('Invalid address format. Usage: /wc <address>', {
        reply_parameters: replyParams,
      });
    }

    try {
      const result = await this.watchService.watchAddress(
        ctx.from.id.toString(),
        'telegram',
        address,
      );
      return ctx.reply(result, { reply_parameters: replyParams });
    } catch (err) {
      this.logger.error('Error watching address', err);
      this.handleCommandError(err, () => {
        return ctx.reply('An error occurred while setting up the watch.', {
          reply_parameters: replyParams,
        });
      });
    }
  }

  async handleUnwatchCreatorCommand(ctx: Context) {
    const parts = ('text' in ctx.message ? ctx.message.text : '').split(' ');

    const address = parts[1];
    const replyParams = {
      message_id: ctx.message.message_id,
      chat_id: ctx.message.chat.id,
    };

    if (!address || !isValidSolanaAddress(address)) {
      return ctx.reply('Invalid address format. Usage: /uc <address>', {
        reply_parameters: replyParams,
      });
    }

    try {
      const result = await this.watchService.unwatchAddress(
        ctx.from.id.toString(),
        'telegram',
        address,
      );
      return ctx.reply(result, { reply_parameters: replyParams });
    } catch (err) {
      this.logger.error('Error unwatching address', err);
      this.handleCommandError(err, () => {
        return ctx.reply('An error occurred while removing the watch.', {
          reply_parameters: replyParams,
        });
      });
    }
  }

  async handleWatchTokenCommand(ctx: Context) {
    const parts = ('text' in ctx.message ? ctx.message.text : '').split(' ');

    const token = parts[1];
    const replyParams = {
      message_id: ctx.message.message_id,
      chat_id: ctx.message.chat.id,
    };

    if (!token || !isValidSolanaAddress(token)) {
      return ctx.reply('Invalid command. Usage: /wt <token>', {
        reply_parameters: replyParams,
      });
    }

    try {
      const result = await this.watchService.watchToken(
        ctx.from.id.toString(),
        'telegram',
        token,
      );
      return ctx.reply(result, { reply_parameters: replyParams });
    } catch (err) {
      this.logger.error('Error watching token', err);
      this.handleCommandError(err, () => {
        return ctx.reply('An error occurred while setting up the watch.', {
          reply_parameters: replyParams,
        });
      });
    }
  }

  async handleUnwatchTokenCommand(ctx: Context) {
    const parts = ('text' in ctx.message ? ctx.message.text : '').split(' ');

    const token = parts[1];
    const replyParams = {
      message_id: ctx.message.message_id,
      chat_id: ctx.message.chat.id,
    };

    if (!token || !isValidSolanaAddress(token)) {
      return ctx.reply('Invalid command. Usage: /ut <token>', {
        reply_parameters: replyParams,
      });
    }

    try {
      const result = await this.watchService.unwatchToken(
        ctx.from.id.toString(),
        'telegram',
        token,
      );
      return ctx.reply(result, { reply_parameters: replyParams });
    } catch (err) {
      this.logger.error('Error unwatching token', err);
      this.handleCommandError(err, () => {
        return ctx.reply('An error occurred while removing the watch.', {
          reply_parameters: replyParams,
        });
      });
    }
  }

  private handleCommandError(err: unknown, cb: () => void) {
    if ((err as any).message?.includes('message to be replied not found'))
      return;
    return cb();
  }
}
