# 🛡️ RugChekker Bot

A social media bot for analyzing Solana tokens and detecting potential risks before investing.

## Features

- **Token Analysis**: Get detailed risk reports for any Solana token
- **Risk Detection**: Identify potential security risks and red flags
- **Market Metrics**: View liquidity, holders, and trading data
- **Token Lists**: Browse new, trending, and verified tokens
- **Multi-Platform**: Available on both Discord and Telegram

## Commands

### Discord

- `!analyze <token>` - Get a detailed risk report on a token.
- `!report <token> <reason> [Attach document as evidence (Optional)]` - Report a suspicious token
- `!creator <creator>` - Get a report on a token creator
- `!new_tokens` - View recently created tokens
- `!recent` - View most viewed tokens
- `!trending` - View trending tokens
- `!verified` - View verified tokens
- `!help` - Display help message

### Telegram

- `/analyze <token>` - Get a detailed risk report
- `/report <token> <reason> [Attach document as evidence (Optional)]` - Report a suspicious token
- `/creator <creator>` - Get a report on a token creator
- `/new_tokens` - View recently created tokens
- `/recent` - View most viewed tokens
- `/trending` - View trending tokens
- `/verified` - View verified tokens
- `/help` - Display help message

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment variables:

```bash
cp .env.example .env
```

Required variables:

- `DISCORD_BOT_TOKEN` - Your Discord bot token
- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
- `RUGCHECK_API_URL` - RugCheck API URL
- `RUGCHECK_API_KEY` - Your RugCheck API key

3. Start the bot:

```bash
# Development
pnpm run start:dev

# Production
pnpm run start:prod
```

## Development

```bash
# Run tests
pnpm test

# Run linter
pnpm lint

# Run type checking
pnpm typecheck
```

## License

MIT Licensed. See the [LICENSE](LICENSE) file for details.
