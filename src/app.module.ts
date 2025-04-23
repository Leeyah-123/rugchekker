import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './modules/ai/ai.module';
import { RugcheckModule } from './modules/rugcheck/rugcheck.module';
import { SocialModule } from './modules/social/social.module';
import { GraphService } from './modules/graph/graph.service';
import { GraphModule } from './modules/graph/graph.module';

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

    // Modules
    AiModule,
    RugcheckModule,
    SocialModule,
    GraphModule,
  ],
  controllers: [AppController],
  providers: [AppService, GraphService],
})
export class AppModule {}
