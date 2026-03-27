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
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService, PushNotificationPayload } from './notifications.service';

class RegisterTokenDto {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
}

class UnregisterTokenDto {
  token: string;
}

class SendTestNotificationDto {
  title: string;
  body: string;
  category?: 'health_alert' | 'medication_reminder' | 'appointment' | 'general' | 'emergency';
}

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register push notification token' })
  @ApiResponse({ status: 200, description: 'Token registered successfully' })
  async registerToken(
    @Request() req,
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
        id: pushToken._id,
        platform: pushToken.platform,
        deviceName: pushToken.deviceName,
      },
    };
  }

  @Delete('unregister-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unregister push notification token' })
  @ApiResponse({ status: 200, description: 'Token unregistered successfully' })
  async unregisterToken(@Body() dto: UnregisterTokenDto) {
    await this.notificationsService.unregisterPushToken(dto.token);

    return {
      success: true,
      message: 'Push token unregistered successfully',
    };
  }

  @Get('tokens')
  @ApiOperation({ summary: 'Get registered push tokens' })
  @ApiResponse({ status: 200, description: 'Returns list of registered tokens' })
  async getUserTokens(@Request() req) {
    const tokens = await this.notificationsService.getUserPushTokens(req.user.userId);

    return {
      success: true,
      data: tokens.map(t => ({
        id: t._id,
        platform: t.platform,
        deviceName: t.deviceName,
        isActive: t.isActive,
        lastUsedAt: t.lastUsedAt,
      })),
    };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send test notification (for development)' })
  @ApiResponse({ status: 200, description: 'Test notification sent' })
  async sendTestNotification(
    @Request() req,
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
  @ApiOperation({ summary: 'Get notification statistics' })
  @ApiResponse({ status: 200, description: 'Returns notification statistics' })
  async getNotificationStats(@Request() req) {
    const stats = await this.notificationsService.getUserNotificationStats(req.user.userId);

    return {
      success: true,
      data: stats,
    };
  }
}
