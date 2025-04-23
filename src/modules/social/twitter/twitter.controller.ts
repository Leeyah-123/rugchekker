import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwitterService } from './twitter.service';
import { TwitterWebhookEvent } from '../../../common/interfaces/twitter';
import * as crypto from 'crypto';

@Controller('twitter')
export class TwitterController {
  constructor(
    private readonly twitterService: TwitterService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Headers('x-twitter-webhooks-signature') signature: string,
    @Body() event: TwitterWebhookEvent,
  ): Promise<void> {
    if (!this.validateWebhook(signature, JSON.stringify(event))) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    await this.twitterService.handleWebhookEvent(event);
  }

  private validateWebhook(signature: string, body: string): boolean {
    const secret = this.config.get('TWITTER_WEBHOOK_SECRET');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('base64');

    return signature === `sha256=${expectedSignature}`;
  }
}
