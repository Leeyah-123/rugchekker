import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { AxiosError } from 'axios';
import { Model } from 'mongoose';
import { lastValueFrom } from 'rxjs';
import {
  CreatorReport,
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

  async getTokenReport(mintAddress: string): Promise<RugCheckTokenReport> {
    const [report, reportStats] = await Promise.all([
      this.fetchTokenReport(mintAddress),
      this.getTokenReportStats(mintAddress),
    ]);

    return {
      ...report,
      communityReports: reportStats,
    };
  }

  private async fetchTokenReport(
    mintAddress: string,
  ): Promise<RugCheckTokenReport> {
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
      const report = new this.tokenReportModel({
        mint,
        ...reportData,
      });
      await report.save();

      return {
        success: true,
        message: 'Token has been reported successfully',
      };
    } catch (error) {
      this.logger.error('Failed to save token report', error);
      return {
        success: false,
        message: 'Failed to save report',
      };
    }
  }

  async getTokenReportStats(mint: string): Promise<TokenReportStats> {
    const reports = await this.tokenReportModel.find({ mint }).exec();
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
    const reports = await this.tokenReportModel.find({ creator }).exec();
    const uniqueTokens = new Set(reports.map((r) => r.mint)).size;

    return {
      reports,
      totalReports: reports.length,
      uniqueTokensReported: uniqueTokens,
    };
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
