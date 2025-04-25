import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { VybeTokenOHCLVResponse } from 'src/common/interfaces/vybe';
import { SUPPORTED_OHLCV_DURATIONS } from 'src/shared/constants';

export interface TokenOHCLV {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

@Injectable()
export class VybeService {
  private readonly logger = new Logger(VybeService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.getOrThrow<string>('VYBE_API_URL');
    this.apiKey = this.config.getOrThrow<string>('VYBE_API_KEY');
  }

  async getTokenOHLCV(
    mintAddress: string,
    duration: keyof typeof SUPPORTED_OHLCV_DURATIONS = '1d',
  ): Promise<{ data: TokenOHCLV[] }> {
    try {
      // Calculate timeStart based on duration
      const timeEnd = Math.floor(Date.now() / 1000); // Current time in seconds
      const durationMap = {
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '30m': 1800,
        '1h': 3600,
        '2h': 7200,
        '4h': 14400,
        '8h': 28800,
        '12h': 43200,
        '1d': 86400,
        '3d': 259200,
        '1w': 604800,
        '1M': 2592000,
      };

      if (!(duration in durationMap)) {
        throw new Error('Invalid duration');
      }

      const timeStart = timeEnd - durationMap[duration];

      const { data } = await firstValueFrom(
        this.httpService.get<VybeTokenOHCLVResponse>(
          `${this.baseUrl}/price/${mintAddress}/token-ohlcv`,
          {
            params: {
              timeStart,
              timeEnd,
            },
            headers: {
              'X-API-KEY': this.apiKey,
              accept: 'application/json',
            },
          },
        ),
      );

      if (!data?.data?.length) {
        throw new Error('No price data available');
      }

      return {
        data: data.data.map((item) => ({
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: parseFloat(item.volume),
          timestamp: item.time * 1000, // Convert to milliseconds
        })),
      };
    } catch (error) {
      this.logger.error('Error fetching OHLCV data:', error);
      throw new Error('Failed to fetch price data');
    }
  }
}
