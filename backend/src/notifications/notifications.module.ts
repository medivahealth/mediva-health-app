import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PushToken, PushTokenSchema } from './schemas/push-token.schema';
import { NotificationLog, NotificationLogSchema } from './schemas/notification-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PushToken.name, schema: PushTokenSchema },
      { name: NotificationLog.name, schema: NotificationLogSchema },
    ]),
    HttpModule,
    ConfigModule,
  ],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
