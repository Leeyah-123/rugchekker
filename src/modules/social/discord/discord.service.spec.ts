import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ButtonInteraction, Client, Message } from 'discord.js';
import { AiService } from '../../ai/ai.service';
import { RugcheckService } from '../../rugcheck/rugcheck.service';
import { DiscordService } from './discord.service';

jest.mock('discord.js');

describe('DiscordService', () => {
  let service: DiscordService;
  let configService: ConfigService;
  let rugcheckService: RugcheckService;
  let client: Client;

  const mockConfig = {
    DISCORD_BOT_TOKEN: 'test-token',
  };

  const mockReport = {
    mint: 'test-mint',
    tokenMeta: { name: 'Test', symbol: 'TEST' },
    score_normalised: 75,
    risks: [],
    price: 1.0,
    totalHolders: 100,
    totalMarketLiquidity: 1000000,
    totalLPProviders: 10,
    transferFee: { pct: 0 },
    verification: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => mockConfig[key]),
          },
        },
        {
          provide: RugcheckService,
          useValue: {
            getTokenReport: jest.fn().mockResolvedValue(mockReport),
            reportToken: jest
              .fn()
              .mockResolvedValue({ success: true, message: 'Reported' }),
            getNewTokens: jest.fn().mockResolvedValue([]),
            getRecentTokens: jest.fn().mockResolvedValue([]),
            getTrendingTokens: jest.fn().mockResolvedValue([]),
            getVerifiedTokens: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: AiService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<DiscordService>(DiscordService);
    configService = module.get<ConfigService>(ConfigService);
    rugcheckService = module.get<RugcheckService>(RugcheckService);
    client = module.get(Client);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize client with token', () => {
      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'DISCORD_BOT_TOKEN',
      );
      expect(client.login).toHaveBeenCalledWith('test-token');
    });
  });

  describe('command handlers', () => {
    const mockMessage = {
      content: '!analyze test-mint',
      author: { bot: false },
      reply: jest.fn().mockReturnThis(),
      edit: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle analyze command', async () => {
      await service['handleAnalyzeCommand'](mockMessage as unknown as Message);

      expect(rugcheckService.getTokenReport).toHaveBeenCalledWith('test-mint');
      expect(mockMessage.reply).toHaveBeenCalled();
    });

    it('should handle report command', async () => {
      mockMessage.content = '!report test-mint';

      await service['handleReportCommand'](mockMessage as unknown as Message);

      expect(rugcheckService.reportToken).toHaveBeenCalledWith('test-mint');
      expect(mockMessage.reply).toHaveBeenCalled();
    });

    it('should handle help command', async () => {
      mockMessage.content = '!help';

      await service['handleHelpCommand'](mockMessage as unknown as Message);
      expect(mockMessage.reply).toHaveBeenCalled();
    });
  });

  describe('button interactions', () => {
    const mockInteraction = {
      customId: 'report_token:test-mint',
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn(),
      user: { bot: false },
    };

    it('should handle report button', async () => {
      await service['handleReportButton'](
        mockInteraction as unknown as ButtonInteraction,
      );

      expect(rugcheckService.reportToken).toHaveBeenCalledWith('test-mint');
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should handle analyze button', async () => {
      mockInteraction.customId = 'analyze_token:test-mint';

      await service['handleAnalyzeButton'](
        mockInteraction as unknown as ButtonInteraction,
      );

      expect(rugcheckService.getTokenReport).toHaveBeenCalledWith('test-mint');
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const mockMessage = {
        content: '!analyze invalid',
        author: { bot: false },
        reply: jest.fn(),
      };

      jest
        .spyOn(rugcheckService, 'getTokenReport')
        .mockRejectedValue(new Error());

      await service['handleAnalyzeCommand'](mockMessage as unknown as Message);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('error occurred'),
      );
    });
  });
});
