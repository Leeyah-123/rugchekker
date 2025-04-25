import { EmbedBuilder, escapeMarkdown, Message } from 'discord.js';
import { CreatorReport } from 'src/common/interfaces/rugcheck';
import { AiService } from 'src/modules/ai/ai.service';
import { GraphService } from 'src/modules/graph/graph.service';
import { RugcheckService } from 'src/modules/rugcheck/rugcheck.service';
import { VybeService } from 'src/modules/vybe/vybe.service';
import { truncateAddress } from 'src/shared/utils';
import { BaseCommands } from '../../base/base.commands';
import { formatRiskReport } from '../handlers/message.handler';
import { formatTokensList } from '../handlers/tokens-list.handler';
import { SUPPORTED_OHLCV_DURATIONS } from 'src/shared/constants';

export class DiscordCommands extends BaseCommands {
  constructor(
    private readonly aiService: AiService,
    private readonly rugcheckService: RugcheckService,
    private readonly graphService: GraphService,
    private readonly birdeyeService: VybeService,
  ) {
    super();
  }

  async handleAnalyzeCommand(msg: Message) {
    const query = msg.content.replace(/^!analyze\s*/, '');

    if (!query) {
      return this.reply(
        msg.reply.bind(msg),
        'Invalid command. Usage: !analyze <token>\nExample: !analyze JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      );
    }

    try {
      const mintAddress = query;
      const name = '';

      const report = await this.rugcheckService.getTokenReport(mintAddress);
      if (typeof report === 'string') {
        return this.reply(msg.reply.bind(msg), report);
      }

      const aiInsights = await this.aiService.analyzeTokenRisks(report);
      const { embed, components } = formatRiskReport(
        name || mintAddress,
        report,
        aiInsights,
      );
      return this.reply(msg.reply.bind(msg), { embeds: [embed], components });
    } catch (err) {
      this.logger.error('Error handling analyze command', err);
      return this.reply(
        msg.reply.bind(msg),
        'An error occurred while processing your request.',
      );
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

      const tokenInfo = await this.rugcheckService.getTokenReport(mintAddress);
      if (typeof tokenInfo === 'string') {
        return loading.edit(tokenInfo);
      }

      const result = await this.rugcheckService.reportToken(mintAddress, {
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
          '`!help` - Display this help message',
      })
      .addFields({
        name: '🔍 Example Usage',
        value: '`!analyze JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN`',
      })
      .setColor(0x4a90e2)
      .setFooter({ text: 'Stay safe with RugChekker' });

    return msg.reply({ embeds: [embed] });
  }

  async handleNewTokensCommand(msg: Message) {
    try {
      const tokens = await this.rugcheckService.getNewTokens();
      const { embed, components } = formatTokensList(
        '🆕 Recently Created Tokens',
        tokens,
      );
      return this.reply(msg.reply.bind(msg), { embeds: [embed], components });
    } catch (err) {
      this.logger.error('Error fetching new tokens', err);
      return this.reply(
        msg.reply.bind(msg),
        'An error occurred while fetching new tokens.',
      );
    }
  }

  async handleRecentCommand(msg: Message) {
    try {
      const tokens = await this.rugcheckService.getRecentTokens();
      const { embed, components } = formatTokensList(
        '👀 Most Viewed Tokens',
        tokens,
      );
      return this.reply(msg.reply.bind(msg), { embeds: [embed], components });
    } catch (err) {
      this.logger.error('Error fetching recent tokens', err);
      return this.reply(
        msg.reply.bind(msg),
        'An error occurred while fetching recent tokens.',
      );
    }
  }

  async handleTrendingCommand(msg: Message) {
    try {
      const tokens = await this.rugcheckService.getTrendingTokens();
      const { embed, components } = formatTokensList(
        '🔥 Trending Tokens',
        tokens,
      );
      return this.reply(msg.reply.bind(msg), { embeds: [embed], components });
    } catch (err) {
      this.logger.error('Error fetching trending tokens', err);
      return this.reply(
        msg.reply.bind(msg),
        'An error occurred while fetching trending tokens.',
      );
    }
  }

  async handleVerifiedCommand(msg: Message) {
    try {
      const tokens = await this.rugcheckService.getVerifiedTokens();
      const { embed, components } = formatTokensList(
        '✅ Recently Verified Tokens',
        tokens,
      );
      return this.reply(msg.reply.bind(msg), { embeds: [embed], components });
    } catch (err) {
      this.logger.error('Error fetching verified tokens', err);
      return this.reply(
        msg.reply.bind(msg),
        'An error occurred while fetching verified tokens.',
      );
    }
  }

  async handleInsidersCommand(msg: Message) {
    try {
      const parts = msg.content.replace(/^!insiders\s*/, '').split(' ');
      const mintAddress = parts[0];
      const participantsOnly = parts[1]?.toLowerCase() === 'participants';

      if (!mintAddress) {
        return this.reply(
          msg.reply.bind(msg),
          'Invalid command. Usage:\n' +
            '!insiders <token> [participants]\n\n' +
            'Examples:\n' +
            '!insiders JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN\n' +
            '!insiders JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN participants',
        );
      }

      const loadingMsg = await msg.reply('Generating insiders graph...');

      const graphData =
        await this.rugcheckService.getInsidersGraph(mintAddress);
      if (typeof graphData === 'string') {
        return this.reply(msg.reply.bind(msg), graphData);
      }

      if (!graphData || graphData.length === 0) {
        return this.reply(
          msg.reply.bind(msg),
          'No insider data found for this token.',
        );
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
        .slice(0, 10);

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

      await loadingMsg.delete();

      return msg.reply({
        embeds: [embed],
        files: [{ attachment: imageBuffer, name: 'insiders.png' }],
      });
    } catch (err) {
      this.logger.error('Error generating insiders graph', err);
      return this.reply(
        msg.reply.bind(msg),
        'An error occurred while generating the insiders graph.',
      );
    }
  }

  async handleCreatorCommand(msg: Message) {
    try {
      const address = msg.content.replace(/^!creator\s*/, '');
      if (!address) {
        return this.reply(
          msg.reply.bind(msg),
          'Invalid command. Usage: !creator <address>\nExample: !creator 7WNRFqMpvqXGi6ytz36fS9tWzNh4ptpkCzASREDBBYoi',
        );
      }

      const report = await this.rugcheckService.getCreatorReport(address);
      const { embed } = this.formatCreatorReport(address, report);
      return this.reply(msg.reply.bind(msg), { embeds: [embed] });
    } catch (err) {
      this.logger.error('Error handling creator command', err);
      return this.reply(
        msg.reply.bind(msg),
        'An error occurred while fetching creator report.',
      );
    }
  }

  async handleAnalyzeNetworkCommand(msg: Message) {
    try {
      const parts = msg.content.replace(/^!analyze_network\s*/, '').split(' ');
      const mintAddress = parts[0];
      const duration = parts[1] || '1d';

      if (!mintAddress) {
        const supportedDurations = Object.entries(SUPPORTED_OHLCV_DURATIONS)
          .map(([key, value]) => `${key} (${value})`)
          .join('\n');

        return this.reply(
          msg.reply.bind(msg),
          'Invalid command. Usage:\n' +
            '!analyze_network <token> [duration]\n\n' +
            'Examples:\n' +
            '!analyze_network JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN\n' +
            '!analyze_network JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN 1d\n\n' +
            'Supported durations:\n' +
            supportedDurations,
        );
      }

      // Validate mint address format (should be 32-44 chars base58)
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mintAddress)) {
        return this.reply(msg.reply.bind(msg), 'Invalid token address format.');
      }

      // Validate duration
      if (!(duration in SUPPORTED_OHLCV_DURATIONS)) {
        return this.reply(
          msg.reply.bind(msg),
          'Invalid duration specified.\n' +
            'Supported durations:\n' +
            Object.entries(SUPPORTED_OHLCV_DURATIONS)
              .map(([key, value]) => `${key} (${value})`)
              .join(', '),
        );
      }

      const loadingMsg = await msg.reply('Analyzing token network...');

      const tokenInfo = await this.rugcheckService.getTokenReport(mintAddress);
      if (typeof tokenInfo === 'string') {
        await loadingMsg.edit(tokenInfo);
        return;
      }

      const candlestickData = await this.birdeyeService.getTokenOHLCV(
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

      await loadingMsg.delete();

      return msg.reply({
        embeds: [embed],
        files: [{ attachment: graphBuffer, name: 'candlestick.png' }],
      });
    } catch (err) {
      this.logger.error('Error analyzing network', err);
      return this.reply(
        msg.reply.bind(msg),
        'An error occurred while analyzing the network.',
      );
    }
  }

  private reply(replyFunction: (payload: any) => any, payload: any) {
    return replyFunction(payload);
  }

  private formatCreatorReport(address: string, report: CreatorReport) {
    const embed = new EmbedBuilder()
      .setTitle(`👤 Creator Report: ${address}`)
      .setDescription(
        `Total Reports: ${report.totalReports}\nUnique Tokens Reported: ${report.uniqueTokensReported}`,
      )
      .setColor(report.totalReports > 0 ? 0xff0000 : 0x00ff00);

    if (report.reports.length > 0) {
      embed.addFields({
        name: '🚨 Recent Reports',
        value: report.reports
          .slice(0, 5)
          .map((r) => {
            const evidenceLink = r.evidence
              ? `\n[View Evidence](${r.evidence})`
              : '';
            return `**Token:** \`${r.mint}\`\n${r.message}${evidenceLink}`;
          })
          .join('\n\n'),
      });
    } else {
      embed.addFields({
        name: '✅ No Reports',
        value: 'No reports found for this creator',
      });
    }

    return { embed };
  }
}
