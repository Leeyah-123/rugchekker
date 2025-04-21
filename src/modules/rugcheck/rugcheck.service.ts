import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { lastValueFrom } from 'rxjs';
import {
  RugCheckTokenReport,
  TokenReportResponse,
  TokenStat,
  RecentToken,
  TrendingToken,
  VerifiedToken,
} from 'src/common/interfaces/rugcheck';

@Injectable()
export class RugcheckService {
  private readonly logger = new Logger(RugcheckService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.getOrThrow<string>('RUGCHECK_API_URL');
    this.apiKey = this.config.getOrThrow<string>('RUGCHECK_API_KEY');
  }

  async getTokenReport(mintAddress: string): Promise<RugCheckTokenReport> {
    try {
      const url = `${this.baseUrl}/tokens/${mintAddress}/report`;
      const response = await lastValueFrom(
        this.httpService.get<RugCheckTokenReport>(url, {
          headers: { Authorization: this.apiKey },
        }),
      );
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `RugCheck API error: ${error.response?.status} - ${error.response?.data}`,
        );
      } else if (error instanceof Error) {
        this.logger.error(`RugCheck API error: ${error.message}`);
      } else {
        this.logger.error('Failed to fetch RugCheck report', error);
      }
      throw error;
    }
  }

  async reportToken(mintAddress: string): Promise<TokenReportResponse> {
    try {
      const url = `${this.baseUrl}/tokens/${mintAddress}/report`;
      const response = await lastValueFrom(
        this.httpService.post<TokenReportResponse>(url, null, {
          headers: { Authorization: this.apiKey },
        }),
      );
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(
          `Failed to report token: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`,
        );

        if (error.response?.data?.error === 'already reported') {
          return {
            success: true,
            message: 'Token has already been reported',
          };
        }

        return {
          success: false,
          message: error.response?.data?.error || 'Failed to report token',
        };
      }
      return {
        success: false,
        message: 'An unexpected error occurred while reporting the token',
      };
    }
  }

  async getNewTokens(): Promise<TokenStat[]> {
    return this.getTokenStats<TokenStat[]>('new_tokens');
  }

  async getRecentTokens(): Promise<RecentToken[]> {
    return this.getTokenStats<RecentToken[]>('recent');
  }

  async getTrendingTokens(): Promise<TrendingToken[]> {
    return this.getTokenStats<TrendingToken[]>('trending');
  }

  async getVerifiedTokens(): Promise<VerifiedToken[]> {
    return this.getTokenStats<VerifiedToken[]>('verified');
  }

  private async getTokenStats<T>(endpoint: string): Promise<T> {
    try {
      const url = `${this.baseUrl}/stats/${endpoint}`;
      const response = await lastValueFrom(
        this.httpService.get<T>(url, {
          headers: { Authorization: this.apiKey },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch ${endpoint} tokens`, error);
      throw error;
    }
  }
}
