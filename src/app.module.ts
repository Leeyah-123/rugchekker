import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './modules/ai/ai.module';
import { GraphModule } from './modules/graph/graph.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RugcheckModule } from './modules/rugcheck/rugcheck.module';
import { SocialModule } from './modules/social/social.module';
import { VybeModule } from './modules/vybe/vybe.module';

@Module({
  imports: [
    // System
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.getOrThrow('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot({
      delimiter: '.',
    }),

    // Modules
    AiModule,
    RugcheckModule,
    SocialModule,
    GraphModule,
    VybeModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
