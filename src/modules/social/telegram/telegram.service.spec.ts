import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Context, Telegraf } from 'telegraf';
import { AiService } from '../../ai/ai.service';
import { RugcheckService } from '../../rugcheck/rugcheck.service';
import { TelegramService } from './telegram.service';

jest.mock('telegraf');

describe('TelegramService', () => {
  let service: TelegramService;
  let configService: ConfigService;
  let rugcheckService: RugcheckService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let bot: Telegraf<Context>;

  const mockConfig = {
    TELEGRAM_BOT_TOKEN: 'test-token',
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
        TelegramService,
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

    service = module.get<TelegramService>(TelegramService);
    configService = module.get<ConfigService>(ConfigService);
    rugcheckService = module.get<RugcheckService>(RugcheckService);
    bot = module.get(Telegraf);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize bot with token', () => {
      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'TELEGRAM_BOT_TOKEN',
      );
      expect(Telegraf).toHaveBeenCalledWith('test-token');
    });
  });

  describe('command handlers', () => {
    const mockContext = {
      reply: jest.fn(),
      replyWithPhoto: jest.fn(),
      answerCbQuery: jest.fn(),
      message: {
        text: '/analyze test-mint',
        message_id: 1,
        chat: { id: 123 },
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle analyze command', async () => {
      await service['handleAnalyze'](mockContext as any);

      expect(rugcheckService.getTokenReport).toHaveBeenCalledWith('test-mint');
      expect(mockContext.replyWithPhoto).toHaveBeenCalled();
    });

    it('should handle report command', async () => {
      mockContext.message.text = '/report test-mint';

      await service['handleReport'](mockContext as any);

      expect(rugcheckService.reportToken).toHaveBeenCalledWith('test-mint');
      expect(mockContext.reply).toHaveBeenCalled();
    });

    it('should handle help command', async () => {
      await service['handleHelpCommand'](mockContext as any);
      expect(mockContext.reply).toHaveBeenCalled();
    });

    it('should handle new tokens command', async () => {
      await service['handleNewTokens'](mockContext as any);
      expect(rugcheckService.getNewTokens).toHaveBeenCalled();
      expect(mockContext.reply).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    const mockContext = {
      reply: jest.fn(),
      message: { text: '/analyze invalid' },
    };

    it('should handle API errors gracefully', async () => {
      jest
        .spyOn(rugcheckService, 'getTokenReport')
        .mockRejectedValue(new Error());

      await service['handleAnalyze'](mockContext as any);

      expect(mockContext.reply).toHaveBeenCalledWith(
        expect.stringContaining('error occurred'),
      );
    });
  });
});
