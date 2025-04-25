import { Logger } from '@nestjs/common';

export abstract class BaseCommands {
  protected readonly logger = new Logger(this.constructor.name);

  abstract handleHelpCommand(...args: any[]): Promise<any>;
  abstract handleAnalyzeCommand(...args: any[]): Promise<any>;
  abstract handleReportCommand(...args: any[]): Promise<any>;
  abstract handleNewTokensCommand(...args: any[]): Promise<any>;
  abstract handleRecentCommand(...args: any[]): Promise<any>;
  abstract handleTrendingCommand(...args: any[]): Promise<any>;
  abstract handleVerifiedCommand(...args: any[]): Promise<any>;
  abstract handleCreatorCommand(...args: any[]): Promise<any>;
  abstract handleInsidersCommand(...args: any[]): Promise<any>;
}
