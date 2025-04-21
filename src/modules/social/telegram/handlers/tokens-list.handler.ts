import {
  RecentToken,
  TokenStat,
  TrendingToken,
  VerifiedToken,
} from 'src/common/interfaces/rugcheck';
import { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

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

  const text = `*${escapeMarkdown(title)}*\n\n${tokenList}`;

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: tokens.flatMap((token) => [
      [
        {
          text: `📊 Check ${'symbol' in token ? token.symbol : token.mint}`,
          callback_data: `check_token:${token.mint}`,
        },
        {
          text: '🚨 Report',
          callback_data: `report_token:${token.mint}`,
        },
      ],
    ]),
  };

  return { text, reply_markup: keyboard };
}
