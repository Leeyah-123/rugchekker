import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscordNotificationService } from './discord-notification.service';
import { TelegramNotificationService } from './telegram-notification.service';

@Module({
  imports: [ConfigModule],
  providers: [DiscordNotificationService, TelegramNotificationService],
})
export class NotificationsModule {}
