import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { RugCheckTokenReport } from 'src/common/interfaces/rugcheck';

export function formatRiskReport(
  tokenLabel: string,
  report: RugCheckTokenReport,
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
    .setTitle(`Risk Report for ${tokenLabel}`)
    .setDescription(
      `Token: ${report.tokenMeta.name} (${report.tokenMeta.symbol})`,
    )
    .addFields(
      {
        name: '📊 Risk Score',
        value: `${report.score_normalised.toFixed(2)}/100`,
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

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`report_token:${report.mint}`)
      .setLabel('Report Token')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🚨'),
  );

  return { embed, components: [row] };
}
