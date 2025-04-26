import { EmbedBuilder, escapeMarkdown, Message } from 'discord.js';
import { AiService } from 'src/modules/ai/ai.service';
import { GraphService } from 'src/modules/graph/graph.service';
import { ReportService } from 'src/modules/report/report.service';
import { RugcheckService } from 'src/modules/rugcheck/rugcheck.service';
import { VybeService } from 'src/modules/vybe/vybe.service';
import { WatchService } from 'src/modules/watch/watch.service';
import { SUPPORTED_OHLCV_DURATIONS } from 'src/shared/constants';
import { isValidSolanaAddress, truncateAddress } from 'src/shared/utils';
import { BaseCommands } from '../../base/base.commands';
import {
  formatCreatorReport,
  formatRiskReport,
} from '../handlers/message.handler';
import { formatTokensList } from '../handlers/tokens-list.handler';

export class DiscordCommands extends BaseCommands {
  constructor(
    private readonly aiService: AiService,
    private readonly rugcheckService: RugcheckService,
    private readonly graphService: GraphService,
    private readonly vybeService: VybeService,
    private readonly watchService: WatchService,
    private readonly reportService: ReportService,
  ) {
    super();
  }

  async handleAnalyzeCommand(msg: Message) {
    const query = msg.content.replace(/^!analyze\s*/, '');

    if (!query) {
      return msg.reply(
        'Invalid command. Usage: !analyze <token>\nExample: !analyze JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      );
    }
    const loading = await msg.reply('Analyzing token security...');

    try {
      const mintAddress = query;
      const name = '';

      // Validate mint address
      if (!mintAddress) return loading.edit('Please provide token address.');
      if (!isValidSolanaAddress(mintAddress))
        return loading.edit('Invalid address provided.');

      const report = await this.rugcheckService.getTokenReport(mintAddress);
      if (typeof report === 'string') {
        return loading.edit(report);
      }

      const aiInsights = await this.aiService.analyzeTokenRisks(report);
      const { embed, components } = formatRiskReport(
        name || mintAddress,
        report,
        aiInsights,
      );
      return loading.edit({ embeds: [embed], components });
    } catch (err) {
      this.logger.error('Error handling analyze command', err);
      return loading.edit('An error occurred while processing your request.');
    }
  }

  async handleReportCommand(msg: Message) {
    const loading = await msg.reply('Processing your report...');
    try {
      const parts = msg.content.replace(/^!report\s*/, '').split(' ');
      const mintAddress = parts[0];
      const reason = parts.slice(1).join(' ');

      if (!mintAddress || !reason) {
        return loading.edit(
          'Invalid command. Usage: !report <token> <reason>\nExample: !report JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN Suspicious activity',
        );
      }
      if (!isValidSolanaAddress(mintAddress))
        return loading.edit('Invalid address provided.');

      const tokenInfo = await this.rugcheckService.getTokenReport(mintAddress);
      if (typeof tokenInfo === 'string') {
        return loading.edit(tokenInfo);
      }

      const result = await this.reportService.reportToken(mintAddress, {
        creator: tokenInfo.creator,
        reportedBy: msg.author.id,
        platform: 'discord',
        message: reason,
        evidence: msg.attachments.first()?.url,
      });

      await loading.edit(result.message);
    } catch (err) {
      this.logger.error('Error handling report command', err);
      await loading.edit('An error occurred while reporting the token.');
    }
  }

  async handleHelpCommand(msg: Message) {
    const loading = await msg.reply('Loading help menu...');
    try {
      const embed = new EmbedBuilder()
        .setTitle('🛡️ RugChekker - Solana Token Security Bot')
        .setDescription(
          'Welcome to RugChekker. Analyze and detect potential risks in Solana tokens before investing.' +
            'Get detailed security reports, market metrics, and risk assessments for any token.',
        )
        .addFields({
          name: '📊 Available Commands',
          value:
            '`!analyze <token>` - Get a detailed risk report\n' +
            '`!report <token> <reason> [Attachment (optional)]` - Report a suspicious token\n' +
            '`!creator <address>` - Get creator report\n' +
            '`!insiders <token> [participants]` - View insider trading network\n' +
            '`!analyze_network <token> [duration]` - Analyze token network activity\n' +
            `Supported durations: ${Object.entries(SUPPORTED_OHLCV_DURATIONS)
              .map(([key, value]) => `${key} (${value})`)
              .join(', ')}\n` +
            '`!new_tokens` - View recently created tokens\n' +
            '`!recent` - View most viewed tokens\n' +
            '`!trending` - View trending tokens\n' +
            '`!verified` - View verified tokens\n' +
            '`!help` - Display this help message\n' +
            '`!wc <address>` - Watch a token creator for reports\n' +
            '`!uc <address>` - Unwatch a token creator address\n' +
            '`!wt <token>` - Watch a token for reports\n' +
            '`!ut <token>` - Unwatch a token',
        })
        .addFields({
          name: '🔍 Example Usage',
          value: '`!analyze JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN`',
        })
        .setColor(0x4a90e2)
        .setFooter({ text: 'Stay safe with RugChekker' });

      return loading.edit({ embeds: [embed] });
    } catch (err) {
      this.logger.error('Error displaying help menu', err);
      return loading.edit('An error occurred while loading the help menu.');
    }
  }

  async handleNewTokensCommand(msg: Message) {
    const loading = await msg.reply('Fetching new tokens...');
    try {
      const tokens = await this.rugcheckService.getNewTokens();
      const { embed, components } = formatTokensList(
        '🆕 Recently Created Tokens',
        tokens,
      );

      return loading.edit({ embeds: [embed], components });
    } catch (err) {
      this.logger.error('Error fetching new tokens', err);
      return loading.edit('An error occurred while fetching new tokens.');
    }
  }

  async handleRecentCommand(msg: Message) {
    const loading = await msg.reply('Fetching recent tokens...');
    try {
      const tokens = await this.rugcheckService.getRecentTokens();
      const { embed, components } = formatTokensList(
        '👀 Most Viewed Tokens',
        tokens,
      );

      return loading.edit({ embeds: [embed], components });
    } catch (err) {
      this.logger.error('Error fetching recent tokens', err);
      return loading.edit('An error occurred while fetching recent tokens.');
    }
  }

  async handleTrendingCommand(msg: Message) {
    const loading = await msg.reply('Fetching trending tokens...');
    try {
      const tokens = await this.rugcheckService.getTrendingTokens();
      const { embed, components } = formatTokensList(
        '🔥 Trending Tokens',
        tokens,
      );

      return loading.edit({ embeds: [embed], components });
    } catch (err) {
      this.logger.error('Error fetching trending tokens', err);
      return loading.edit('An error occurred while fetching trending tokens.');
    }
  }

  async handleVerifiedCommand(msg: Message) {
    const loading = await msg.reply('Fetching verified tokens...');
    try {
      const tokens = await this.rugcheckService.getVerifiedTokens();
      const { embed, components } = formatTokensList(
        '✅ Recently Verified Tokens',
        tokens,
      );

      return loading.edit({ embeds: [embed], components });
    } catch (err) {
      this.logger.error('Error fetching verified tokens', err);
      return loading.edit('An error occurred while fetching verified tokens.');
    }
  }

  async handleInsidersCommand(msg: Message) {
    const loading = await msg.reply('Generating insiders graph...');

    try {
      const parts = msg.content.replace(/^!insiders\s*/, '').split(' ');
      const mintAddress = parts[0];
      const participantsOnly = parts[1]?.toLowerCase() === 'participants';

      if (!mintAddress) {
        return loading.edit(
          'Invalid command. Usage:\n' +
            '!insiders <token> [participants]\n\n' +
            'Examples:\n' +
            '!insiders JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN\n' +
            '!insiders JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN participants',
        );
      }
      if (!isValidSolanaAddress(mintAddress))
        return loading.edit('Invalid address provided.');

      const graphData =
        await this.rugcheckService.getInsidersGraph(mintAddress);
      if (typeof graphData === 'string') {
        return loading.edit(graphData);
      }

      if (!graphData || graphData.length === 0) {
        return loading.edit('No insider data found for this token.');
      }
      const imageBuffer = await this.graphService.generateInsidersGraph(
        graphData as any,
        participantsOnly,
      );

      const embed = new EmbedBuilder()
        .setTitle('Insider Trade Network Analysis')
        .setDescription(
          `Mode: ${participantsOnly ? 'Participants Only' : 'All Accounts'}`,
        )
        .setColor(0x4a90e2)
        .setImage('attachment://insiders.png');

      // Include holders information
      const nodes = graphData.flatMap((item) => item.nodes);
      const holders = nodes
        .filter((n) => n.holdings > 0)
        .sort((a, b) => b.holdings - a.holdings)
        .slice(0, 7);

      if (holders.length > 0) {
        embed.addFields({
          name: '🔝 Top Insider Holders',
          value: holders
            .map((n) =>
              escapeMarkdown(
                `[${truncateAddress(n.id, 4, 4)}](https://solscan.io/account/${n.id}): ${n.holdings}`,
              ),
            )
            .join('\n'),
        });
      }

      return loading.edit({
        embeds: [embed],
        files: [{ attachment: imageBuffer, name: 'insiders.png' }],
      });
    } catch (err) {
      this.logger.error('Error generating insiders graph', err);
      return loading.edit(
        'An error occurred while generating the insiders graph.',
      );
    }
  }

  async handleCreatorCommand(msg: Message) {
    const loading = await msg.reply('Fetching creator report...');
    try {
      const address = msg.content.replace(/^!creator\s*/, '');
      if (!address) {
        return loading.edit(
          'Invalid command. Usage: !creator <address>\nExample: !creator 7WNRFqMpvqXGi6ytz36fS9tWzNh4ptpkCzASREDBBYoi',
        );
      }
      if (!isValidSolanaAddress(address)) {
        return loading.edit('Invalid address provided.');
      }

      const report = await this.reportService.getCreatorReport(address);
      const { embed } = formatCreatorReport(address, report);

      return loading.edit({ embeds: [embed] });
    } catch (err) {
      this.logger.error('Error handling creator command', err);
      return loading.edit('An error occurred while fetching creator report.');
    }
  }

  async handleAnalyzeNetworkCommand(msg: Message) {
    const loading = await msg.reply('Analyzing token network...');
    try {
      const parts = msg.content.replace(/^!analyze_network\s*/, '').split(' ');
      const mintAddress = parts[0];
      const duration = parts[1] || '1d';

      if (!mintAddress) {
        const supportedDurations = Object.entries(SUPPORTED_OHLCV_DURATIONS)
          .map(([key, value]) => `${key} (${value})`)
          .join('\n');

        return loading.edit(
          'Invalid command. Usage:\n' +
            '!analyze_network <token> [duration]\n\n' +
            'Examples:\n' +
            '!analyze_network JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN\n' +
            '!analyze_network JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN 1d\n\n' +
            'Supported durations:\n' +
            supportedDurations,
        );
      }

      if (!isValidSolanaAddress(mintAddress)) {
        return loading.edit('Invalid token address format.');
      }

      // Validate duration
      if (!(duration in SUPPORTED_OHLCV_DURATIONS)) {
        return loading.edit(
          'Invalid duration specified.\n' +
            'Supported durations:\n' +
            Object.entries(SUPPORTED_OHLCV_DURATIONS)
              .map(([key, value]) => `${key} (${value})`)
              .join(', '),
        );
      }

      const tokenInfo = await this.rugcheckService.getTokenReport(mintAddress);
      if (typeof tokenInfo === 'string') {
        await loading.edit(tokenInfo);
        return;
      }

      const candlestickData = await this.vybeService.getTokenOHLCV(
        mintAddress,
        duration as any,
      );
      if (candlestickData.data.length === 0) {
        return loading.edit('No candlestick data found for this token.');
      }

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

      const embed = new EmbedBuilder()
        .setTitle(`${tokenInfo.tokenMeta.name} (${tokenInfo.tokenMeta.symbol})`)
        .setDescription(
          '**🔍 AI Network Analysis:**\n' +
            aiAnalysis +
            '\n\n**⚠️ Disclaimer:**\n' +
            'This AI analysis is for informational purposes only and may or may not be accurate. Always conduct your own research (DYOR) before making any investment decisions.',
        )
        .setColor(0x4a90e2)
        .setImage('attachment://candlestick.png');

      return loading.edit({
        embeds: [embed],
        files: [{ attachment: graphBuffer, name: 'candlestick.png' }],
      });
    } catch (err) {
      this.logger.error('Error analyzing network', err);
      return loading.edit('An error occurred while analyzing the network.');
    }
  }

  async handleWatchCreatorCommand(msg: Message) {
    const loading = await msg.reply('Setting up creator watch...');
    try {
      const parts = msg.content.replace(/^!wc\s*/, '').split(' ');
      const address = parts[0];

      if (!address) {
        return loading.edit('Invalid format. Usage: !wc <address>');
      }
      if (!isValidSolanaAddress(address)) {
        return loading.edit('Invalid address provided.');
      }

      const result = await this.watchService.watchAddress(
        msg.author.id,
        'discord',
        address,
      );

      return loading.edit(result);
    } catch (err) {
      this.logger.error('Error watching address', err);
      return loading.edit('An error occurred while setting up the watch.');
    }
  }

  async handleUnwatchCreatorCommand(msg: Message) {
    const loading = await msg.reply('Removing creator watch...');
    try {
      const parts = msg.content.replace(/^uc\s*/, '').split(' ');
      const address = parts[0];

      if (!address) {
        return loading.edit('Invalid format. Usage: !uc <address>');
      }
      if (!isValidSolanaAddress(address)) {
        return loading.edit('Invalid address provided.');
      }

      const result = await this.watchService.unwatchAddress(
        msg.author.id,
        'discord',
        address,
      );

      return loading.edit(result);
    } catch (err) {
      this.logger.error('Error unwatching address', err);
      return loading.edit('An error occurred while removing the watch.');
    }
  }

  async handleWatchTokenCommand(msg: Message) {
    const loading = await msg.reply('Setting up token watch...');
    try {
      const parts = msg.content.replace(/^!wt\s*/, '').split(' ');
      const token = parts[0];

      if (!token) {
        return loading.edit('Invalid format. Usage: !wt <token>');
      }
      if (!isValidSolanaAddress(token)) {
        return loading.edit('Invalid token address provided.');
      }

      const result = await this.watchService.watchToken(
        msg.author.id,
        'discord',
        token,
      );

      return loading.edit(result);
    } catch (err) {
      this.logger.error('Error watching token', err);
      return loading.edit('An error occurred while setting up the watch.');
    }
  }

  async handleUnwatchTokenCommand(msg: Message) {
    const loading = await msg.reply('Removing token watch...');
    try {
      const parts = msg.content.replace(/^!ut\s*/, '').split(' ');
      const token = parts[0];

      if (!token) {
        return loading.edit('Invalid format. Usage: !ut <token>');
      }
      if (!isValidSolanaAddress(token)) {
        return loading.edit('Invalid token address provided.');
      }

      const result = await this.watchService.unwatchToken(
        msg.author.id,
        'discord',
        token,
      );

      return loading.edit(result);
    } catch (err) {
      this.logger.error('Error unwatching token', err);
      return loading.edit('An error occurred while removing the watch.');
    }
  }
}
