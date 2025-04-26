import { escapeMarkdown } from 'src/shared/utils';
import {
  RecentToken,
  TokenStat,
  TrendingToken,
  VerifiedToken,
} from 'src/common/interfaces/rugcheck';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

type TokenListType =
  | TokenStat[]
  | RecentToken[]
  | TrendingToken[]
  | VerifiedToken[];

function formatTokenItem(
  token: TokenStat | RecentToken | TrendingToken | VerifiedToken,
): string {
  if ('createAt' in token) {
    return (
      `🔹 *${escapeMarkdown(token.symbol)}*\n` +
      `├ Mint: \`${escapeMarkdown(token.mint)}\`\n` +
      `└ Created: ${escapeMarkdown(new Date(token.createAt).toLocaleString())}`
    );
  } else if ('metadata' in token) {
    return (
      `🔹 *${escapeMarkdown(token.metadata.symbol)}*\n` +
      `├ Mint: \`${escapeMarkdown(token.mint)}\`\n` +
      `└ Visits: ${token.visits}`
    );
  } else if ('up_count' in token) {
    return (
      `🔹 *${escapeMarkdown(token.mint)}*\n` +
      `├ Votes: ${token.vote_count}\n` +
      `└ Upvotes: ${token.up_count}`
    );
  } else {
    return (
      `🔹 *${escapeMarkdown(token.symbol)}*\n` +
      `├ Mint: \`${escapeMarkdown(token.mint)}\`\n` +
      `└ ${token.jup_verified ? '✅ Verified' : '❌ Unverified'}`
    );
  }
}

export function formatTokensList(
  title: string,
  tokens: TokenListType,
): {
  text: string;
  reply_markup: InlineKeyboardMarkup;
} {
  const tokenList = tokens.map(formatTokenItem).join('\n\n');
  const footerMessage =
    tokens.length > 5
      ? `\n\n_Showing actions for first 5 tokens out of ${tokens.length}\\. Use /analyze \\<token\\> or /report \\<token\\> to analyze or report other tokens\\._`
      : '';

  const text = `*${escapeMarkdown(title)}*\n\n${tokenList}${footerMessage}`;

  // Only create keyboard buttons for first 5 tokens
  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: tokens.slice(0, 5).map((token) => [
      {
        text: `📊 Analyze ${
          ('symbol' in token && token.symbol) ||
          ('metadata' in token && token.metadata.symbol) ||
          `${token.mint.slice(0, 6)}...`
        }`,
        callback_data: `analyze_token:${token.mint}`,
      },
      {
        text: `🚨 Report ${
          ('symbol' in token && token.symbol) ||
          ('metadata' in token && token.metadata.symbol) ||
          `${token.mint.slice(0, 6)}...`
        }`,
        callback_data: `report_token:${token.mint}`,
      },
    ]),
  };

  return { text, reply_markup: keyboard };
}
