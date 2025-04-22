import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class TokenReport extends Document {
  @Prop({ required: true })
  mint: string;

  @Prop({ required: true })
  creator: string;

  @Prop({ required: true })
  reportedBy: string;

  @Prop({ required: true })
  platform: string;

  @Prop({ required: true })
  message: string;

  @Prop()
  evidence?: string;

  @Prop({ default: new Date() })
  createdAt: Date;
}

export const TokenReportSchema = SchemaFactory.createForClass(TokenReport);

// Add indexes for frequent queries
TokenReportSchema.index({ mint: 1 });
TokenReportSchema.index({ creator: 1 });
TokenReportSchema.index({ createdAt: -1 });
