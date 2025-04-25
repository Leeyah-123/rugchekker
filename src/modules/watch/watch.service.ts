import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WatchSubscription } from 'src/schemas/watch-subscription.schema';

@Injectable()
export class WatchService {
  private readonly logger = new Logger(WatchService.name);

  constructor(
    @InjectModel(WatchSubscription.name)
    private watchSubscriptionModel: Model<WatchSubscription>,
  ) {}

  async watchAddress(
    userId: string,
    platform: string,
    address: string,
  ): Promise<string> {
    try {
      const existing = await this.watchSubscriptionModel.findOne({
        userId,
        platform,
        watchedAddress: address,
      });

      if (existing) {
        return 'You are already watching this address.';
      }

      const subscription = new this.watchSubscriptionModel({
        userId,
        platform,
        watchedAddress: address,
      });
      await subscription.save();

      return 'Successfully started watching this address.';
    } catch (error) {
      this.logger.error('Failed to watch address', error);
      throw error;
    }
  }

  async unwatchAddress(
    userId: string,
    platform: string,
    address: string,
  ): Promise<string> {
    try {
      const result = await this.watchSubscriptionModel.deleteOne({
        userId,
        platform,
        watchedAddress: address,
      });

      return result.deletedCount > 0
        ? 'Successfully stopped watching this address.'
        : 'You were not watching this address.';
    } catch (error) {
      this.logger.error('Failed to unwatch address', error);
      throw error;
    }
  }

  async watchToken(
    userId: string,
    platform: string,
    token: string,
  ): Promise<string> {
    try {
      const existing = await this.watchSubscriptionModel.findOne({
        userId,
        platform,
        watchedToken: token,
      });

      if (existing) {
        return 'You are already watching this token.';
      }

      const subscription = new this.watchSubscriptionModel({
        userId,
        platform,
        watchedToken: token,
      });
      await subscription.save();

      return 'Successfully started watching this token.';
    } catch (error) {
      this.logger.error('Failed to watch token', error);
      throw error;
    }
  }

  async unwatchToken(
    userId: string,
    platform: string,
    token: string,
  ): Promise<string> {
    try {
      const result = await this.watchSubscriptionModel.deleteOne({
        userId,
        platform,
        watchedToken: token,
      });

      return result.deletedCount > 0
        ? 'Successfully stopped watching this token.'
        : 'You were not watching this token.';
    } catch (error) {
      this.logger.error('Failed to unwatch token', error);
      throw error;
    }
  }

  async getWatchersForItem(params: {
    token?: string;
    creator?: string;
  }): Promise<WatchSubscription[]> {
    try {
      if (!params.token && !params.creator) {
        throw new Error('Either token or creator must be provided.');
      }

      return await this.watchSubscriptionModel
        .find(
          params.token
            ? { watchedToken: params.token }
            : { watchedAddress: params.creator },
        )
        .exec();
    } catch (error) {
      this.logger.error('Failed to get watchers', error);
      throw error;
    }
  }
}
