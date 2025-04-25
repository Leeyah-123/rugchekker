import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { AxiosError } from 'axios';
import { Model } from 'mongoose';
import { lastValueFrom } from 'rxjs';
import {
  CreatorReport,
  InsidersGraphData,
  RecentToken,
  RugCheckTokenReport,
  TokenReportResponse,
  TokenReportStats,
  TokenStat,
  TrendingToken,
  VerifiedToken,
} from 'src/common/interfaces/rugcheck';
import { TokenReport } from 'src/schemas/token-report.schema';

@Injectable()
export class RugcheckService {
  private readonly logger = new Logger(RugcheckService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    @InjectModel(TokenReport.name)
    private tokenReportModel: Model<TokenReport>,
  ) {
    this.baseUrl = this.config.getOrThrow<string>('RUGCHECK_API_URL');
    this.apiKey = this.config.getOrThrow<string>('RUGCHECK_API_KEY');
  }

  async getTokenReport(
    mintAddress: string,
  ): Promise<RugCheckTokenReport | string> {
    try {
      const [apiReport, communityReports] = await Promise.all([
        this.fetchTokenReport(mintAddress),
        this.getTokenReportStats(mintAddress),
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

  async reportToken(
    mint: string,
    reportData: {
      creator: string;
      reportedBy: string;
      platform: string;
      message: string;
      evidence?: string;
    },
  ): Promise<TokenReportResponse> {
    try {
      // Check if user has reported this token before
      const existingReport = await this.tokenReportModel.findOne({
        mint,
        reportedBy: reportData.reportedBy,
      });
      if (existingReport) {
        return {
          success: false,
          message: 'You have already reported this token.',
        };
      }

      const report = new this.tokenReportModel({
        mint,
        ...reportData,
      });
      await report.save();

      return {
        success: true,
        message: 'Token has been reported successfully.',
      };
    } catch (error) {
      this.logger.error('Failed to save token report', error);
      return {
        success: false,
        message: 'Failed to save report.',
      };
    }
  }

  async getTokenReportStats(mint: string): Promise<TokenReportStats> {
    const reports = await this.tokenReportModel
      .find({ mint })
      .sort({ createdAt: -1 })
      .exec();
    const creator = reports[0]?.creator;

    const creatorReports = creator
      ? (await this.tokenReportModel.find({ creator }).exec()).length
      : 0;

    return {
      tokenReports: reports.length,
      creatorReports,
      reports,
    };
  }

  async getCreatorReport(creator: string): Promise<CreatorReport> {
    try {
      const reports = await this.tokenReportModel
        .find({ creator })
        .sort({ createdAt: -1 })
        .exec();

      return {
        reports,
        totalReports: reports.length,
        uniqueTokensReported: new Set(reports.map((r) => r.mint)).size,
      };
    } catch (error) {
      this.logger.error('Failed to fetch creator reports', error);
      throw error;
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
