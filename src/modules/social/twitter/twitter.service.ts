import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwitterApi } from 'twitter-api-v2';
import { AiService } from '../../ai/ai.service';
import { RugcheckService } from '../../rugcheck/rugcheck.service';
import { BasePlatformService } from '../base/base.service';
import {
  TwitterWebhookEvent,
  TweetCreateEvent,
  DirectMessageEvent,
} from '../../../common/interfaces/twitter';

@Injectable()
export class TwitterService extends BasePlatformService {
  private readonly client: TwitterApi;
  private readonly logger = new Logger(TwitterService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly aiService: AiService,
    private readonly rugcheckService: RugcheckService,
  ) {
    super();
    this.client = new TwitterApi({
      appKey: this.config.getOrThrow('TWITTER_API_KEY'),
      appSecret: this.config.getOrThrow('TWITTER_API_SECRET'),
      accessToken: this.config.getOrThrow('TWITTER_ACCESS_TOKEN'),
      accessSecret: this.config.getOrThrow('TWITTER_ACCESS_SECRET'),
    });
  }

  async handleWebhookEvent(event: TwitterWebhookEvent): Promise<void> {
    try {
      if (event.tweet_create_events?.length) {
        await this.handleTweets(event.tweet_create_events);
      }
      if (event.direct_message_events?.length) {
        await this.handleDirectMessages(event.direct_message_events);
      }
    } catch (err) {
      this.logger.error('Error handling webhook event', err);
    }
  }

  private async handleTweets(tweets: TweetCreateEvent[]): Promise<void> {
    for (const tweet of tweets) {
      try {
        const command = this.parseCommand(tweet.text);
        if (!command) continue;

        switch (command.type) {
          case 'analyze':
            await this.handleAnalyzeCommand(tweet, command.args);
            break;
          case 'report':
            await this.handleReportCommand(tweet, command.args);
            break;
          // ...implement other commands...
        }
      } catch (err) {
        this.logger.error(`Error handling tweet ${tweet.id_str}`, err);
      }
    }
  }

  private async handleDirectMessages(dms: DirectMessageEvent[]): Promise<void> {
    // Similar to handleTweets but for DMs
    // ...implement DM handling...
  }

  private parseCommand(text: string): { type: string; args: string[] } | null {
    const match = text.match(/^(?:@\w+\s+)?!(\w+)\s+(.*)/i);
    if (!match) return null;

    return {
      type: match[1].toLowerCase(),
      args: match[2].split(/\s+/),
    };
  }

  private async handleAnalyzeCommand(
    tweet: TweetCreateEvent,
    args: string[],
  ): Promise<void> {
    const [mintAddress] = args;
    if (!mintAddress) {
      await this.replyToTweet(
        tweet,
        'Please provide a token address to analyze',
      );
      return;
    }

    try {
      const report = await this.rugcheckService.getTokenReport(mintAddress);
      const aiInsights = await this.aiService.analyzeTokenRisks(report);
      const response = this.formatAnalyzeResponse(report, aiInsights);

      await this.replyToTweet(tweet, response);
    } catch (err) {
      this.logger.error('Error analyzing token', err);
      await this.replyToTweet(
        tweet,
        'Failed to analyze token. Please try again later.',
      );
    }
  }

  private async handleReportCommand(
    tweet: TweetCreateEvent,
    args: string[],
  ): Promise<void> {
    // ...implement report command...
  }

  private async replyToTweet(
    tweet: TweetCreateEvent,
    message: string,
  ): Promise<void> {
    try {
      await this.client.v2.reply(message, tweet.id_str);
    } catch (err) {
      this.logger.error('Error replying to tweet', err);
    }
  }

  private formatAnalyzeResponse(report: any, aiInsights: string): string {
    // Format response within Twitter's character limit
    // ...implement response formatting...
  }
}
