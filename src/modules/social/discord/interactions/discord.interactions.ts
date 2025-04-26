import { Logger } from '@nestjs/common';
import {
  ActionRowBuilder,
  ButtonInteraction,
  Message,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { AiService } from 'src/modules/ai/ai.service';
import { ReportService } from 'src/modules/report/report.service';
import { RugcheckService } from 'src/modules/rugcheck/rugcheck.service';
import { isValidSolanaAddress } from 'src/shared/utils';
import {
  formatCreatorReport,
  formatRiskReport,
} from '../handlers/message.handler';

export class DiscordInteractions {
  private readonly logger = new Logger(DiscordInteractions.name);

  constructor(
    private readonly aiService: AiService,
    private readonly rugcheckService: RugcheckService,
    private readonly reportService: ReportService,
  ) {}

  async handleReportButton(interaction: ButtonInteraction) {
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

  async handleReportModalSubmit(interaction: ModalSubmitInteraction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const [, mintAddress] = interaction.customId.split(':');
      const reason = interaction.fields.getTextInputValue('report_reason');

      if (!mintAddress || !isValidSolanaAddress(mintAddress)) {
        return interaction.editReply({
          content: 'Invalid mint address provided.',
        });
      }
      if (!reason || reason.length < 10) {
        return interaction.editReply({
          content: 'Please provide a valid reason for reporting.',
        });
      }

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
      if (typeof tokenInfo === 'string') {
        return interaction.editReply(tokenInfo);
      }

      const result = await this.reportService.reportToken(mintAddress, {
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

  async handleCreatorButton(interaction: ButtonInteraction) {
    try {
      const address = interaction.customId.split(':')[1];
      if (!address || address === 'unknown') {
        return interaction.reply({
          content: 'Token creator is unknown.',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply();
      const report = await this.reportService.getCreatorReport(address);
      const { embed } = formatCreatorReport(address, report);

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      this.logger.error('Error processing creator button', err);
      await interaction.editReply(
        'An error occurred while fetching creator report.',
      );
    }
  }

  async handleAnalyzeButton(interaction: ButtonInteraction) {
    try {
      const mintAddress = interaction.customId.split(':')[1];

      await interaction.deferReply();
      const report = await this.rugcheckService.getTokenReport(mintAddress);
      if (typeof report === 'string') {
        return interaction.editReply(report);
      }

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
}
