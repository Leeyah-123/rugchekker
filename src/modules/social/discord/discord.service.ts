import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActionRowBuilder,
  ButtonInteraction,
  Client,
  EmbedBuilder,
  IntentsBitField,
  Message,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { CreatorReport } from 'src/common/interfaces/rugcheck';
import { AiService } from '../../ai/ai.service';
import { RugcheckService } from '../../rugcheck/rugcheck.service';
import { BasePlatformService } from '../base/base.service';
import {
  formatCreatorReport,
  formatRiskReport,
} from './handlers/message.handler';
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

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;

      const commandMap = {
        '!analyze': this.handleAnalyzeCommand.bind(this),
        '!report': this.handleReportCommand.bind(this),
        '!creator': this.handleCreatorCommand.bind(this),
        '!help': this.handleHelpCommand.bind(this),
        '!new_tokens': this.handleNewTokens.bind(this),
        '!recent': this.handleRecent.bind(this),
        '!trending': this.handleTrending.bind(this),
        '!verified': this.handleVerified.bind(this),
      };

      const command = message.content.split(' ')[0].toLowerCase();
      if (commandMap[command]) {
        await commandMap[command](message);
      }
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (interaction.isButton()) {
        if (interaction.customId.startsWith('report_token:')) {
          await this.handleReportButton(interaction);
        } else if (interaction.customId.startsWith('check_creator:')) {
          await this.handleCreatorButton(interaction);
        } else if (interaction.customId.startsWith('analyze_token:')) {
          await this.handleAnalyzeButton(interaction);
        }
      } else if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('report_modal:')) {
          await this.handleReportModalSubmit(interaction);
        }
      }
    });
  }

  initializeClient(): void {
    const token = this.config.getOrThrow<string>('DISCORD_BOT_TOKEN');
    this.client.on('ready', () => {
      this.logger.log(`Logged in as ${this.client.user.tag}`);
    });
    this.client.login(token).catch((err) => this.logger.error(err));
  }

  async onMessage(payload: any): Promise<any> {
    return this.handleMessage(payload as Message);
  }

  private async handleMessage(msg: Message) {
    if (msg.author.bot) return;

    const command = msg.content.split(' ')[0].toLowerCase();
    switch (command) {
      case '!analyze':
        await this.handleAnalyzeCommand(msg);
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
      case '!creator':
        await this.handleCreatorCommand(msg);
        break;
    }
  }

  private async handleAnalyzeCommand(msg: Message) {
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

  private async handleReportCommand(msg: Message) {
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

  private async handleHelpCommand(msg: Message) {
    const embed = new EmbedBuilder()
      .setTitle('🛡️ RugChekker - Solana Token Security Bot')
      .setDescription(
        'RugChekker helps you analyze and detect potential risks in Solana tokens before investing. ' +
          'Get detailed security reports, market metrics, and risk assessments for any token.',
      )
      .addFields({
        name: '📊 Available Commands',
        value:
          '`!analyze <token>` - Get a detailed risk report\n' +
          '`!report <token> <reason> [Attachment (optional)]` - Report a suspicious token\n' +
          '`!creator <address>` - Get creator report\n' +
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

      const modal = new ModalBuilder()
        .setCustomId(`report_modal:${mintAddress}`)
        .setTitle('Report Token')
        .addComponents([
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('report_reason')
              .setLabel('Why are you reporting this token?')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMinLength(10)
              .setMaxLength(1000)
              .setPlaceholder('Describe why you are reporting this token...'),
          ),
        ]);

      await interaction.showModal(modal);
    } catch (err) {
      this.logger.error('Error showing report modal', err);
      await interaction.reply({
        content: 'An error occurred while creating the report form.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  private async handleReportModalSubmit(interaction: ModalSubmitInteraction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const [, mintAddress] = interaction.customId.split(':');
      const reason = interaction.fields.getTextInputValue('report_reason');

      // Ask for optional evidence
      await interaction.editReply({
        content:
          'Please upload any evidence (images, documents) or type "skip" to submit without evidence. You have 2 minutes to respond.',
      });

      // Wait for file attachment or skip message
      const messageFilter = (m: Message) =>
        m.author.id === interaction.user.id &&
        (m.attachments.size > 0 || m.content.toLowerCase() === 'skip');

      let evidence: string | undefined;

      try {
        const collected = await interaction.channel?.awaitMessages({
          filter: messageFilter,
          max: 1,
          time: 120000,
          errors: ['time'],
        });

        const attachmentMessage = collected?.first();
        if (attachmentMessage) {
          if (attachmentMessage.content.toLowerCase() !== 'skip') {
            evidence = attachmentMessage.attachments.first()?.url;
            await interaction.editReply({
              content: 'Evidence received. Processing your report...',
            });
          } else {
            await interaction.editReply({
              content: 'Processing report without evidence...',
            });
          }
          // Clean up user's response
          await attachmentMessage.delete().catch(() => {});
        }
      } catch (err) {
        this.logger.error('Error collecting evidence', err);
        await interaction.editReply({
          content:
            'No evidence provided within time limit. Processing report without evidence...',
        });
      }

      // Get token info to get creator
      const tokenInfo = await this.rugcheckService.getTokenReport(mintAddress);

      const result = await this.rugcheckService.reportToken(mintAddress, {
        creator: tokenInfo.creator,
        reportedBy: interaction.user.id,
        platform: 'discord',
        message: reason,
        evidence,
      });

      // Final update with result
      await interaction.editReply({
        content: `${result.message}${evidence ? '\n\nEvidence has been attached to your report.' : ''}`,
      });
    } catch (err) {
      this.logger.error('Error processing report modal', err);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: 'An error occurred while submitting your report.',
        });
      } else {
        await interaction.reply({
          content: 'An error occurred while submitting your report.',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  }

  private async handleCreatorCommand(msg: Message) {
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

  private async handleCreatorButton(interaction: ButtonInteraction) {
    try {
      const address = interaction.customId.split(':')[1];
      if (!address || address === 'unknown') {
        return interaction.reply({
          content: 'Token creator is unknown.',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply();
      const report = await this.rugcheckService.getCreatorReport(address);
      const { embed } = formatCreatorReport(address, report);

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      this.logger.error('Error processing creator button', err);
      await interaction.editReply(
        'An error occurred while fetching creator report.',
      );
    }
  }

  private async handleAnalyzeButton(interaction: ButtonInteraction) {
    try {
      const mintAddress = interaction.customId.split(':')[1];

      await interaction.deferReply();
      const report = await this.rugcheckService.getTokenReport(mintAddress);
      const aiInsights = await this.aiService.analyzeTokenRisks(report);
      const { embed, components } = formatRiskReport(
        mintAddress,
        report,
        aiInsights,
      );

      await interaction.editReply({ embeds: [embed], components });
    } catch (err) {
      this.logger.error('Error processing analyze button', err);
      await interaction.editReply(
        'An error occurred while analyzing the token.',
      );
    }
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
