import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CreatorReport,
  TokenReportResponse,
  TokenReportStats,
} from 'src/common/interfaces/rugcheck';
import { TokenReport } from 'src/schemas/token-report.schema';
import { WatchSubscription } from 'src/schemas/watch-subscription.schema';
import { TokenReportEvent } from '../notifications/payloads/token-report-event.payload';
import { WatchService } from '../watch/watch.service';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @InjectModel(TokenReport.name)
    private tokenReportModel: Model<TokenReport>,
    private readonly watchService: WatchService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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

      // Notify watchers after successful report
      await this.notifyWatchers(report);

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

  private async notifyWatchers(report: TokenReport): Promise<void> {
    try {
      const tokenWatchers = await this.watchService.getWatchersForItem({
        token: report.mint,
      });
      const creatorWatchers = await this.watchService.getWatchersForItem({
        creator: report.creator,
      });

      // Group watchers by platform for efficient notification
      const tokenWatchersByPlatform = tokenWatchers.reduce((acc, watcher) => {
        if (!acc[watcher.platform]) {
          acc[watcher.platform] = [];
        }
        acc[watcher.platform].push(watcher);
        return acc;
      }, {});
      const creatorWatchersByPlatform = creatorWatchers.reduce(
        (acc, watcher) => {
          if (!acc[watcher.platform]) {
            acc[watcher.platform] = [];
          }
          acc[watcher.platform].push(watcher);
          return acc;
        },
        {},
      );

      // Emit events for each platform to handle notifications
      Object.entries(tokenWatchersByPlatform).forEach(
        ([platform, platformWatchers]) => {
          this.eventEmitter.emit(
            `token-reported.${platform}`,
            new TokenReportEvent(
              platformWatchers as WatchSubscription[],
              report,
              'token',
            ),
          );
        },
      );
      Object.entries(creatorWatchersByPlatform).forEach(
        ([platform, platformWatchers]) => {
          this.eventEmitter.emit(
            `token-reported.${platform}`,
            new TokenReportEvent(
              platformWatchers as WatchSubscription[],
              report,
              'creator',
            ),
          );
        },
      );
    } catch (error) {
      this.logger.error('Failed to notify watchers', error);
    }
  }
}
