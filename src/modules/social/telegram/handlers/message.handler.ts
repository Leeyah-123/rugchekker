import { RugCheckTokenReport } from 'src/common/interfaces/rugcheck';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

export function formatTelegramReport(
  tokenLabel: string,
  report: RugCheckTokenReport,
): { text: string; reply_markup: InlineKeyboardMarkup } {
  const riskList =
    report.risks
      .map(
        (risk) =>
          `🔸 ${escapeMarkdown(risk.name)}: ${escapeMarkdown(risk.level)}`,
      )
      .join('\n') || 'None';

  const riskEmoji =
    report.score_normalised > 70
      ? '🟢'
      : report.score_normalised > 40
        ? '🟡'
        : '🔴';

  const verificationInfo = report.verification
    ? `${report.verification.jup_verified ? '✅ Verified' : '❌ Unverified'}${
        report.verification.description
          ? `\n├ ${escapeMarkdown(report.verification.description)}`
          : ''
      }${
        report.verification.links?.length
          ? `\n└ Links: ${report.verification.links
              .map(
                (link) =>
                  `[${escapeMarkdown(link.provider)}](${escapeMarkdown(link.value)})`,
              )
              .join(', ')}`
          : ''
      }`
    : '❓ Verification status unknown';

  const text =
    `🔍 *Risk Report for ${escapeMarkdown(tokenLabel)}*\n\n` +
    `💎 *Token Info*\n` +
    `├ Name: ${escapeMarkdown(report.tokenMeta.name)}\n` +
    `├ Symbol: ${escapeMarkdown(report.tokenMeta.symbol)}\n` +
    `├ Price: $${escapeMarkdown(report.price.toFixed(4))}\n` +
    `├ Total Holders: ${escapeMarkdown(report.totalHolders.toLocaleString())}\n` +
    `└ Total Liquidity: $${escapeMarkdown(report.totalMarketLiquidity.toLocaleString(undefined, { maximumFractionDigits: 2 }))}\n\n` +
    `⚠️ *Risk Assessment*\n` +
    `├ Risk Score: ${riskEmoji} ${escapeMarkdown(report.score_normalised.toFixed(2))}/100\n` +
    `└ Verification: ${verificationInfo}\n\n` +
    `🚨 *Risk Factors*\n${riskList}\n\n` +
    `📊 *Market Info*\n` +
    `├ LP Providers: ${escapeMarkdown(report.totalLPProviders.toLocaleString())}\n` +
    `└ Transfer Fee: ${report.transferFee.pct > 0 ? '⚠️' : '✅'} ${escapeMarkdown(report.transferFee.pct.toString())}%`;

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        {
          text: '🚨 Report Token',
          callback_data: `report_token:${report.mint}`,
        },
      ],
    ],
  };

  return { text, reply_markup: keyboard };
}
