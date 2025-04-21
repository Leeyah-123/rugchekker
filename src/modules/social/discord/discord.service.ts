import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ButtonInteraction,
  Client,
  EmbedBuilder,
  IntentsBitField,
  Message,
} from 'discord.js';
import { AiService } from '../../ai/ai.service';
import { RugcheckService } from '../../rugcheck/rugcheck.service';
import { BasePlatformService } from '../base/base.service';
import { formatRiskReport } from './handlers/message.handler';
import { formatTokensList } from './handlers/tokens-list.handler';

@Injectable()
export class DiscordService extends BasePlatformService {
  private client: Client;

  constructor(
    private readonly config: ConfigService,
    private readonly aiService: AiService,
    private readonly rugcheckService: RugcheckService,
  ) {
    super();
    this.client = new Client({
      intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
      ],
    });
  }

  initializeClient(): void {
    const token = this.config.getOrThrow<string>('DISCORD_BOT_TOKEN');
    this.client.on('ready', () => {
      this.logger.log(`Logged in as ${this.client.user.tag}`);
    });
    this.client.on('messageCreate', (msg) => this.handleMessage(msg));
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;
      if (interaction.customId.startsWith('report_token:')) {
        await this.handleReportButton(interaction);
      }
    });
    this.client.login(token).catch((err) => this.logger.error(err));
  }

  async onMessage(payload: any): Promise<any> {
    // If using webhook, payload should be a Discord Message object
    return this.handleMessage(payload as Message);
  }

  private async handleMessage(msg: Message) {
    if (msg.author.bot) return;

    const command = msg.content.split(' ')[0].toLowerCase();
    switch (command) {
      case '!check':
        await this.handleCheckCommand(msg);
        break;
      case '!report':
        await this.handleReportCommand(msg);
        break;
      case '!help':
        await this.handleHelpCommand(msg);
        break;
      case '!new_tokens':
        await this.handleNewTokens(msg);
        break;
      case '!recent':
        await this.handleRecent(msg);
        break;
      case '!trending':
        await this.handleTrending(msg);
        break;
      case '!verified':
        await this.handleVerified(msg);
        break;
    }
  }

  private async handleCheckCommand(msg: Message) {
    const query = msg.content.replace(/^!check\s*/, '');

    if (!query) {
      return this.reply(
        msg.reply.bind(msg),
        'Invalid command. Usage: !check <token>\nExample: !check JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      );
    }

    try {
      const mintAddress = query;
      const name = '';

      const report = await this.rugcheckService.getTokenReport(mintAddress);
      const { embed, components } = formatRiskReport(
        name || mintAddress,
        report,
      );
      return this.reply(msg.reply.bind(msg), { embeds: [embed], components });
    } catch (err) {
      this.logger.error('Error handling check command', err);
      return this.reply(
        msg.reply.bind(msg),
        'An error occurred while processing your request.',
      );
    }
  }

  private async handleReportCommand(msg: Message) {
    const query = msg.content.replace(/^!report\s*/, '');

    if (!query) {
      return this.reply(
        msg.reply.bind(msg),
        'Invalid command. Usage: !report <token>\nExample: !report JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      );
    }

    try {
      const mintAddress = query;
      const reply = await msg.reply('Processing report...');

      const result = await this.rugcheckService.reportToken(mintAddress);

      await reply.edit(result.message);
    } catch (err) {
      this.logger.error('Error handling report command', err);
      return this.reply(
        msg.reply.bind(msg),
        'An error occurred while reporting the token.',
      );
    }
  }

  private async handleHelpCommand(msg: Message) {
    const helpEmbed = new EmbedBuilder()
      .setTitle('🛡️ RugChekker - Solana Token Security Bot')
      .setDescription(
        'RugChekker helps you analyze and detect potential risks in Solana tokens before investing. ' +
          'Get detailed security reports, market metrics, and risk assessments for any token.',
      )
      .addFields(
        {
          name: '📊 Available Commands',
          value: [
            '`!check <token>` - Get a detailed risk report for a token',
            '`!report <token>` - Report a suspicious token',
            '`!help` - Display this help message',
          ].join('\n'),
        },
        {
          name: '🔍 Example Usage',
          value: '`!check JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN`',
        },
      )
      .setColor(0x4a90e2)
      .setFooter({ text: 'Stay safe with RugChekker' })
      .setTimestamp();

    return this.reply(msg.reply.bind(msg), { embeds: [helpEmbed] });
  }

  private async handleNewTokens(msg: Message) {
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

  private async handleRecent(msg: Message) {
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

  private async handleTrending(msg: Message) {
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

  private async handleVerified(msg: Message) {
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

  private async handleReportButton(interaction: ButtonInteraction) {
    try {
      const mintAddress = interaction.customId.split(':')[1];

      await interaction.deferReply({ flags: 64 });
      const result = await this.rugcheckService.reportToken(mintAddress);

      await interaction.editReply(
        result.message || 'Token has been reported successfully',
      );
    } catch (err) {
      this.logger.error('Error processing report button', err);
      await interaction.editReply(
        'An error occurred while reporting the token.',
      );
    }
  }
}
