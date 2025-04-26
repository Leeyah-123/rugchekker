import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class WatchSubscription extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  platform: string;

  @Prop()
  watchedAddress?: string;

  @Prop()
  watchedToken?: string;

  @Prop({ default: new Date() })
  createdAt: Date;
}

export const WatchSubscriptionSchema =
  SchemaFactory.createForClass(WatchSubscription);

// Add indexes for better query performance
WatchSubscriptionSchema.index({ userId: 1, platform: 1 });
WatchSubscriptionSchema.index({ watchedAddress: 1 });
WatchSubscriptionSchema.index({ watchedToken: 1 });
