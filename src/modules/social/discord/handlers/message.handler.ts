import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { RugCheckTokenReport } from 'src/common/interfaces/rugcheck';
import { TokenReport } from 'src/schemas/token-report.schema';
import { truncateAddress } from 'src/shared/utils';

export function formatRiskReport(
  tokenLabel: string,
  report: RugCheckTokenReport,
  aiInsights?: string,
): { embed: EmbedBuilder; components: ActionRowBuilder<ButtonBuilder>[] } {
  const verificationStatus = {
    name: '🔒 Verification',
    value: report.verification
      ? `${report.verification.jup_verified ? '✅ Verified' : '❌ Unverified'}${
          report.verification.description
            ? `\n${report.verification.description}`
            : ''
        }${
          report.verification.links?.length
            ? `\nLinks: ${report.verification.links
                .map((link) => `[${link.provider}](${link.value})`)
                .join(', ')}`
            : ''
        }`
      : '❓ Verification status unknown',
    inline: true,
  };

  const embed = new EmbedBuilder()
    .setTitle(
      `Risk Report for ${report.tokenMeta.name} (${report.tokenMeta.symbol})`,
    )
    .addFields(
      {
        name: '🪙 Token Info',
        value: [
          `Address: [${report.mint}](https://solscan.io/token/${report.mint})`,
          `Creator: ${report.creator ? `[${report.creator}](https://solscan.io/account/${report.creator})` : 'None'}`,
          `Program: [${report.tokenProgram}](https://solscan.io/account/${report.tokenProgram})`,
          `Type: ${report.tokenType}`,
        ].join('\n'),
      },
      {
        name: '📊 Risk Score',
        value: `${report.score_normalised.toFixed(2)}/10 ${report.score_normalised <= 4 ? '🔴' : report.score_normalised <= 7 ? '🟡' : '🟢'}`,
        inline: true,
      },
      verificationStatus,
      {
        name: '💰 Price',
        value: `$${report.price.toFixed(4)}`,
        inline: true,
      },
      {
        name: '💎 Market Metrics',
        value: [
          `Total Liquidity: $${report.totalMarketLiquidity.toFixed(2)}`,
          `Total Holders: ${report.totalHolders}`,
          `LP Providers: ${report.totalLPProviders}`,
        ].join('\n'),
      },
      {
        name: '⚠️ Risk Factors',
        value:
          report.risks
            .map(
              (risk) => `**${risk.name}** (${risk.level})\n${risk.description}`,
            )
            .join('\n\n') || 'None',
      },
    )
    .setColor(
      report.score_normalised > 70
        ? 0x00ff00
        : report.score_normalised > 40
          ? 0xffff00
          : 0xff0000,
    )
    .setTimestamp();

  if (report.fileMeta?.image) {
    embed.setThumbnail(report.fileMeta.image);
    embed.setImage(report.fileMeta.image);
  }

  if (report.communityReports) {
    embed.addFields({
      name: '🚨 Community Reports',
      value: `Token Reports: ${report.communityReports.tokenReports}\nCreator Reports: ${report.communityReports.creatorReports}`,
      inline: true,
    });
  }

  if (aiInsights) {
    embed.addFields({
      name: '🤖 AI Insights',
      value: `${aiInsights}\n\n*Disclaimer: AI insights are generated automatically and should be taken with a grain of salt. Always DYOR.*`,
    });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`check_creator:${report.creator || 'unknown'}`)
      .setLabel('Check Creator')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👤'),
    new ButtonBuilder()
      .setCustomId(`report_token:${report.mint}`)
      .setLabel('Report Token')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🚨'),
  );

  return { embed, components: [row] };
}

export function formatCreatorReport(
  address: string,
  report: {
    reports: TokenReport[];
    totalReports: number;
    uniqueTokensReported: number;
  },
): { embed: EmbedBuilder } {
  const embed = new EmbedBuilder()
    .setTitle(`Creator Report: ${address}`)
    .addFields(
      {
        name: '📊 Report Stats',
        value: `Total Reports: ${report.totalReports}\nUnique Tokens Reported: ${report.uniqueTokensReported}`,
      },
      {
        name: '🚨 Recent Reports',
        value:
          report.reports
            .slice(0, 5)
            .map(
              (r) =>
                `**Token: [${truncateAddress(r.mint, 4, 4)}](https://solscan.io/token/${r.mint})**\n${r.message}\nReported: ${new Date(
                  r.createdAt,
                ).toLocaleDateString()}`,
            )
            .join('\n\n') || 'No reports found',
      },
    )
    .setColor(0xff0000)
    .setTimestamp();

  return { embed };
}
