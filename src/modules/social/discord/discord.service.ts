import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, IntentsBitField, Message } from 'discord.js';
import { GraphService } from 'src/modules/graph/graph.service';
import { VybeService } from 'src/modules/vybe/vybe.service';
import { AiService } from '../../ai/ai.service';
import { RugcheckService } from '../../rugcheck/rugcheck.service';
import { BasePlatformService } from '../base/base.service';
import { DiscordCommands } from './commands/discord.commands';
import { DiscordInteractions } from './interactions/discord.interactions';

@Injectable()
export class DiscordService extends BasePlatformService {
  private client: Client;
  private readonly commands: DiscordCommands;
  private readonly interactions: DiscordInteractions;

  constructor(
    private readonly config: ConfigService,
    private readonly aiService: AiService,
    private readonly rugcheckService: RugcheckService,
    private readonly graphService: GraphService,
    private readonly birdeyeService: VybeService,
  ) {
    super();
    this.client = new Client({
      intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
      ],
    });
    this.commands = new DiscordCommands(
      this.aiService,
      this.rugcheckService,
      this.graphService,
      this.birdeyeService,
    );
    this.interactions = new DiscordInteractions(
      this.aiService,
      this.rugcheckService,
    );

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;

      const commandMap = {
        '!analyze': this.commands.handleAnalyzeCommand.bind(this),
        '!report': this.commands.handleReportCommand.bind(this),
        '!creator': this.commands.handleCreatorCommand.bind(this),
        '!help': this.commands.handleHelpCommand.bind(this),
        '!new_tokens': this.commands.handleNewTokensCommand.bind(this),
        '!recent': this.commands.handleRecentCommand.bind(this),
        '!trending': this.commands.handleTrendingCommand.bind(this),
        '!verified': this.commands.handleVerifiedCommand.bind(this),
        '!insiders': this.commands.handleInsidersCommand.bind(this),
        '!analyze_network':
          this.commands.handleAnalyzeNetworkCommand.bind(this),
      };

      const command = message.content.split(' ')[0].toLowerCase();
      if (commandMap[command]) {
        await commandMap[command](message);
      }
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (interaction.isButton()) {
        if (interaction.customId.startsWith('report_token:')) {
          await this.interactions.handleReportButton(interaction);
        } else if (interaction.customId.startsWith('check_creator:')) {
          await this.interactions.handleCreatorButton(interaction);
        } else if (interaction.customId.startsWith('analyze_token:')) {
          await this.interactions.handleAnalyzeButton(interaction);
        }
      } else if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('report_modal:')) {
          await this.interactions.handleReportModalSubmit(interaction);
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
        await this.commands.handleAnalyzeCommand(msg);
        break;
      case '!report':
        await this.commands.handleReportCommand(msg);
        break;
      case '!help':
        await this.commands.handleHelpCommand(msg);
        break;
      case '!new_tokens':
        await this.commands.handleNewTokensCommand(msg);
        break;
      case '!recent':
        await this.commands.handleRecentCommand(msg);
        break;
      case '!trending':
        await this.commands.handleTrendingCommand(msg);
        break;
      case '!verified':
        await this.commands.handleVerifiedCommand(msg);
        break;
      case '!creator':
        await this.commands.handleCreatorCommand(msg);
        break;
      case '!insiders':
        await this.commands.handleInsidersCommand(msg);
        break;
      case '!analyze_network':
        await this.commands.handleAnalyzeNetworkCommand(msg);
        break;
      default:
        this.logger.log(`Unknown command: ${command}`);
        await msg.reply({
          content: 'Unknown command. Use !help for a list of commands.',
        });
        break;
    }
  }
}
