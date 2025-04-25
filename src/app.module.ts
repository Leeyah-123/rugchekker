import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './modules/ai/ai.module';
import { GraphModule } from './modules/graph/graph.module';
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

    // Modules
    AiModule,
    RugcheckModule,
    SocialModule,
    GraphModule,
    VybeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
