import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { lastValueFrom } from 'rxjs';
import {
  InsidersGraphData,
  RecentToken,
  RugCheckTokenReport,
  TokenStat,
  TrendingToken,
  VerifiedToken,
} from 'src/common/interfaces/rugcheck';
import { ReportService } from '../report/report.service';

@Injectable()
export class RugcheckService {
  private readonly logger = new Logger(RugcheckService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly reportService: ReportService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.getOrThrow<string>('RUGCHECK_API_URL');
    this.apiKey = this.config.getOrThrow<string>('RUGCHECK_API_KEY');
  }

  // Keep only API-related methods
  async getTokenReport(
    mintAddress: string,
  ): Promise<RugCheckTokenReport | string> {
    try {
      const [apiReport, communityReports] = await Promise.all([
        this.fetchTokenReport(mintAddress),
        this.reportService.getTokenReportStats(mintAddress),
      ]);

      return typeof apiReport === 'string'
        ? apiReport
        : {
            ...apiReport,
            communityReports,
          };
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

  private async fetchTokenReport(
    mintAddress: string,
  ): Promise<RugCheckTokenReport | string> {
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

        if (
          error.response.data.error === 'not found' ||
          error.response.data.error === 'invalid token mint'
        ) {
          return 'Token not found or not supported.';
        }

        return error.response.data.error;
      }

      this.logger.error(`RugCheck API error: ${error.message}`);
      return 'An error occurred while fetching the token report.';
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

      // Sort tokens by createdAt in descending order if array has createAt property
      if (Array.isArray(response.data) && response.data.length > 0) {
        if ('createAt' in response.data[0]) {
          return response.data.sort(
            (a: any, b: any) =>
              new Date(b.createAt).getTime() - new Date(a.createAt).getTime(),
          ) as T;
        }
      }

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch ${endpoint} tokens`, error);
      throw error;
    }
  }

  async getInsidersGraph(
    mintAddress: string,
  ): Promise<InsidersGraphData[] | string> {
    try {
      const url = `${this.baseUrl}/tokens/${mintAddress}/insiders/graph`;
      const response = await lastValueFrom(
        this.httpService.get<InsidersGraphData[]>(url, {
          headers: { Authorization: this.apiKey },
        }),
      );
      return response.data;
    } catch (error) {
      if (error.response.data.error === 'not found') {
        return 'Token not found or not supported';
      }

      this.logger.error('Failed to fetch insiders graph', error);
      throw error;
    }
  }
}
