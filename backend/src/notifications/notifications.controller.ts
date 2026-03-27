import {
  Controller,
  Post,
  Body,
  Delete,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService, PushNotificationPayload } from './notifications.service';

// Use interfaces instead of classes for DTOs to avoid strict initialization errors
interface RegisterTokenDto {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
}

interface UnregisterTokenDto {
  token: string;
}

interface SendTestNotificationDto {
  title: string;
  body: string;
  category?: 'health_alert' | 'medication_reminder' | 'appointment' | 'general' | 'emergency';
}

// Custom request type with user
interface RequestWithUser extends Request {
  user: {
    userId: string;
  };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-token')
  @HttpCode(HttpStatus.OK)
  async registerToken(
    @Request() req: RequestWithUser,
    @Body() dto: RegisterTokenDto,
  ) {
    const pushToken = await this.notificationsService.registerPushToken(
      req.user.userId,
      dto.token,
      dto.platform,
      {
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        appVersion: dto.appVersion,
      },
    );

    return {
      success: true,
      message: 'Push token registered successfully',
      data: {
        id: (pushToken as any)._id?.toString() || pushToken.token.slice(0, 20),
        platform: pushToken.platform,
        deviceName: pushToken.deviceName,
      },
    };
  }

  @Delete('unregister-token')
  @HttpCode(HttpStatus.OK)
  async unregisterToken(@Body() dto: UnregisterTokenDto) {
    await this.notificationsService.unregisterPushToken(dto.token);

    return {
      success: true,
      message: 'Push token unregistered successfully',
    };
  }

  @Get('tokens')
  async getUserTokens(@Request() req: RequestWithUser) {
    const tokens = await this.notificationsService.getUserPushTokens(req.user.userId);

    return {
      success: true,
      data: tokens.map(t => ({
        id: (t as any)._id?.toString() || t.token.slice(0, 20),
        platform: t.platform,
        deviceName: t.deviceName,
        isActive: t.isActive,
        lastUsedAt: t.lastUsedAt,
      })),
    };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async sendTestNotification(
    @Request() req: RequestWithUser,
    @Body() dto: SendTestNotificationDto,
  ) {
    const payload: PushNotificationPayload = {
      title: dto.title || 'Test Notification',
      body: dto.body || 'This is a test notification from Mediva',
      category: dto.category || 'general',
    };

    const result = await this.notificationsService.sendNotificationToUser(
      req.user.userId,
      payload,
    );

    return {
      success: result.success,
      message: result.success 
        ? 'Test notification sent successfully' 
        : 'Failed to send test notification',
      data: {
        sent: result.sent,
        failed: result.failed,
      },
    };
  }

  @Get('stats')
  async getNotificationStats(@Request() req: RequestWithUser) {
    const stats = await this.notificationsService.getUserNotificationStats(req.user.userId);

    return {
      success: true,
      data: stats,
    };
  }
}
