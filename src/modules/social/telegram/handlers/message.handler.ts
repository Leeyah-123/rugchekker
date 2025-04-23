import { RugCheckTokenReport } from 'src/common/interfaces/rugcheck';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

const MAX_CAPTION_LENGTH = 1024; // Telegram's limit for photo captions

function splitLongMessage(text: string): string[] {
  const parts: string[] = [];
  let currentPart = '';

  text.split('\n').forEach((line) => {
    if ((currentPart + line + '\n').length > MAX_CAPTION_LENGTH) {
      if (currentPart) {
        parts.push(currentPart.trim());
        currentPart = '';
      }
      // If single line is too long, split it
      if (line.length > MAX_CAPTION_LENGTH) {
        const chunks =
          line.match(new RegExp(`.{1,${MAX_CAPTION_LENGTH}}`, 'g')) || [];
        parts.push(...chunks.slice(0, -1));
        currentPart = chunks[chunks.length - 1] + '\n';
      } else {
        currentPart = line + '\n';
      }
    } else {
      currentPart += line + '\n';
    }
  });

  if (currentPart) {
    parts.push(currentPart.trim());
  }

  return parts;
}

export function formatTelegramReport(
  tokenLabel: string,
  report: RugCheckTokenReport,
  aiInsights?: string,
): {
  text: string;
  caption: string;
  continuation?: string[];
  reply_markup: InlineKeyboardMarkup;
} {
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

  let text =
    `🔍 *Risk Report for ${escapeMarkdown(tokenLabel)}*\n\n` +
    `💎 *Token Info*\n` +
    `├ Name: ${escapeMarkdown(report.tokenMeta.name)}\n` +
    `├ Symbol: ${escapeMarkdown(report.tokenMeta.symbol)}\n` +
    `├ Price: $${escapeMarkdown(report.price.toFixed(4))}\n` +
    `├ Creator: ${report.creator ? `[${escapeMarkdown(report.creator)}](https://solscan.io/account/${report.creator})` : 'Unknown'}\n` +
    `├ Program: [${escapeMarkdown(report.tokenProgram)}](https://solscan.io/account/${report.tokenProgram})\n` +
    `└ Token Address: [${escapeMarkdown(report.mint)}](https://solscan.io/token/${report.mint})\n\n` +
    `📈 *Market Metrics*\n` +
    `├ Total Holders: ${escapeMarkdown(report.totalHolders.toLocaleString())}\n` +
    `└ Total Liquidity: $${escapeMarkdown(report.totalMarketLiquidity.toLocaleString(undefined, { maximumFractionDigits: 2 }))}\n\n` +
    `⚠️ *Risk Assessment*\n` +
    `├ Risk Score: ${riskEmoji} ${escapeMarkdown(report.score_normalised.toFixed(2))}/100\n` +
    `└ Verification: ${verificationInfo}\n\n` +
    `🚨 *Risk Factors*\n${riskList}\n\n` +
    `📊 *Market Info*\n` +
    `├ LP Providers: ${escapeMarkdown(report.totalLPProviders.toLocaleString())}\n` +
    `└ Transfer Fee: ${report.transferFee.pct > 0 ? '⚠️' : '✅'} ${escapeMarkdown(report.transferFee.pct.toString())}%`;

  // Add community reports section
  if (report.communityReports) {
    text +=
      '\n\n*🚨 Community Reports*\n' +
      `├ Token Reports: ${report.communityReports.tokenReports}\n` +
      `└ Creator Reports: ${report.communityReports.creatorReports}`;

    if (report.communityReports.reports.length > 0) {
      text +=
        '\n\n*Recent Reports:*\n' +
        report.communityReports.reports
          .slice(0, 3)
          .map((r) => `• ${escapeMarkdown(r.message)}`)
          .join('\n');
    }
  }

  // Add AI insights if available
  if (aiInsights) {
    text +=
      '\n\n*🤖 AI Insights*\n' +
      escapeMarkdown(aiInsights) +
      '\n\n_Disclaimer: AI insights are generated automatically and should be taken with a grain of salt\\. Always DYOR\\._';
  }

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        {
          text: '👤 Check Creator',
          callback_data: `check_creator:${report.creator}`,
        },
      ],
      [
        {
          text: '🚨 Report Token',
          callback_data: `report_token:${report.mint}`,
        },
      ],
    ],
  };

  const allParts = splitLongMessage(text);

  return {
    text: allParts[0], // Full text for non-photo messages
    caption: allParts[0], // First part for photo caption
    continuation: allParts.slice(1), // Additional parts to send as separate messages
    reply_markup: keyboard,
  };
}
