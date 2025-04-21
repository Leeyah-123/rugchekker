import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';
import { RugcheckService } from './rugcheck.service';

describe('RugcheckService', () => {
  let service: RugcheckService;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockConfig = {
    RUGCHECK_API_URL: 'http://api.test',
    RUGCHECK_API_KEY: 'test-key',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RugcheckService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get<RugcheckService>(RugcheckService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should load configuration correctly', () => {
      expect(configService.getOrThrow).toHaveBeenCalledWith('RUGCHECK_API_URL');
      expect(configService.getOrThrow).toHaveBeenCalledWith('RUGCHECK_API_KEY');
    });
  });

  describe('getTokenReport', () => {
    const mintAddress = 'test-mint';
    const mockReport = { mint: mintAddress, score: 100 };

    it('should fetch token report successfully', async () => {
      jest.spyOn(httpService, 'get').mockReturnValueOnce(
        of({
          data: mockReport,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { headers: {} as any },
        }),
      );

      const result = await service.getTokenReport(mintAddress);
      expect(result).toEqual(mockReport);
      expect(httpService.get).toHaveBeenCalledWith(
        `http://api.test/tokens/${mintAddress}/report`,
        { headers: { Authorization: 'test-key' } },
      );
    });

    it('should handle API errors correctly', async () => {
      const error = new AxiosError();
      error.response = { status: 404, data: 'Not found' } as any;

      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(throwError(() => error));

      await expect(service.getTokenReport(mintAddress)).rejects.toThrow();
    });
  });

  describe('reportToken', () => {
    const mintAddress = 'test-mint';
    const mockResponse = { success: true, message: 'Reported successfully' };

    it('should report token successfully', async () => {
      jest.spyOn(httpService, 'post').mockReturnValueOnce(
        of({
          data: mockResponse,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { headers: {} as any },
        }),
      );

      const result = await service.reportToken(mintAddress);
      expect(result).toEqual(mockResponse);
      expect(httpService.post).toHaveBeenCalledWith(
        `http://api.test/tokens/${mintAddress}/report`,
        null,
        { headers: { Authorization: 'test-key' } },
      );
    });

    it('should handle already reported tokens', async () => {
      const error = new AxiosError();
      error.response = {
        status: 400,
        data: { error: 'already reported' },
      } as any;

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(throwError(() => error));

      const result = await service.reportToken(mintAddress);
      expect(result.success).toBe(true);
      expect(result.message).toContain('already been reported');
    });
  });

  describe('getTokenStats', () => {
    const mockTokens = [{ mint: 'test-mint', score: 100 }];

    it('should fetch new tokens successfully', async () => {
      jest.spyOn(httpService, 'get').mockReturnValueOnce(
        of({
          data: mockTokens,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { headers: {} as any },
        }),
      );

      const result = await service.getNewTokens();
      expect(result).toEqual(mockTokens);
      expect(httpService.get).toHaveBeenCalledWith(
        'http://api.test/stats/new_tokens',
        { headers: { Authorization: 'test-key' } },
      );
    });

    it('should fetch recent tokens successfully', async () => {
      jest.spyOn(httpService, 'get').mockReturnValueOnce(
        of({
          data: mockTokens,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { headers: {} as any },
        }),
      );

      const result = await service.getRecentTokens();
      expect(result).toEqual(mockTokens);
      expect(httpService.get).toHaveBeenCalledWith(
        'http://api.test/stats/recent',
        { headers: { Authorization: 'test-key' } },
      );
    });

    it('should fetch trending tokens successfully', async () => {
      jest.spyOn(httpService, 'get').mockReturnValueOnce(
        of({
          data: mockTokens,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { headers: {} as any },
        }),
      );

      const result = await service.getTrendingTokens();
      expect(result).toEqual(mockTokens);
      expect(httpService.get).toHaveBeenCalledWith(
        'http://api.test/stats/trending',
        { headers: { Authorization: 'test-key' } },
      );
    });

    it('should fetch verified tokens successfully', async () => {
      jest.spyOn(httpService, 'get').mockReturnValueOnce(
        of({
          data: mockTokens,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { headers: {} as any },
        }),
      );

      const result = await service.getVerifiedTokens();
      expect(result).toEqual(mockTokens);
      expect(httpService.get).toHaveBeenCalledWith(
        'http://api.test/stats/verified',
        { headers: { Authorization: 'test-key' } },
      );
    });

    it('should handle API errors in stats endpoints', async () => {
      const error = new AxiosError();
      error.response = { status: 500, data: 'Server error' } as any;

      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(throwError(() => error));

      await expect(service.getNewTokens()).rejects.toThrow();
    });
  });
});
