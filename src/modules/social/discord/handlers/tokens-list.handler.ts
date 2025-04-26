import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import {
  RecentToken,
  TokenStat,
  TrendingToken,
  VerifiedToken,
} from 'src/common/interfaces/rugcheck';
import { truncateAddress } from 'src/shared/utils';

type TokenListType =
  | TokenStat[]
  | RecentToken[]
  | TrendingToken[]
  | VerifiedToken[];

function formatTokenDescription(
  token: TokenStat | RecentToken | TrendingToken | VerifiedToken,
): string {
  if ('createAt' in token) {
    // TokenStat
    return `**${token.symbol}**\nMint: [${truncateAddress(token.mint)}](https://solscan\.io/token/${token.mint})\nCreated: ${new Date(token.createAt).toLocaleString()}`;
  } else if ('metadata' in token) {
    // RecentToken
    return `**${token.metadata.symbol}**\nMint: [${truncateAddress(token.mint)}](https://solscan.io/token/${token.mint})\nVisits: ${token.visits}\nScore: ${token.score}`;
  } else if ('up_count' in token) {
    // TrendingToken
    return `**Token**\nMint: [${truncateAddress(token.mint)}](https://solscan.io/token/${token.mint})\nUpvotes: ${token.up_count}\nTotal Votes: ${token.vote_count}`;
  } else {
    // VerifiedToken
    const links =
      token.links &&
      token.links.length &&
      token.links.map((link) => `[${link.provider}](${link.value})`).join(', ');
    return `**${token.symbol}**\nMint: [${truncateAddress(token.mint)}](https://solscan.io/token/${token.mint})\n${token.jup_verified ? '✅ Verified' : '❌ Unverified'}${links ? `\nLinks: ${links}` : ''}`;
  }
}

export function formatTokensList(
  title: string,
  tokens: TokenListType,
): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(
      tokens
        .slice(0, 10)
        .map((token, index) => `${index + 1}. ${formatTokenDescription(token)}`)
        .join('\n\n'),
    )
    .setColor(0x4a90e2)
    .setTimestamp();

  // Create action rows for first 5 tokens only (Discord limit)
  const components = tokens.slice(0, 5).map((token) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`analyze_token:${token.mint}`)
        .setLabel(
          `Analyze ${
            ('symbol' in token && token.symbol) ||
            ('metadata' in token && token.metadata.symbol) ||
            `${truncateAddress(token.mint)}`
          }`,
        )
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setCustomId(`report_token:${token.mint}`)
        .setLabel(
          `Report ${
            ('symbol' in token && token.symbol) ||
            ('metadata' in token && token.metadata.symbol) ||
            `${truncateAddress(token.mint)}`
          }`,
        )
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🚨'),
    ),
  );

  if (tokens.length > 5) {
    embed.setFooter({
      text: `Showing actions for first 5 tokens out of ${tokens.length}. Use !analyze <token> or !report <token> to analyze or report other tokens.`,
    });
  }

  return { embed, components };
}
