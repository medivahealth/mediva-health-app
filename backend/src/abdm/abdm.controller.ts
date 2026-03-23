import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AbdmService } from './abdm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

class EnrollDto {
  @IsString() @IsNotEmpty() method!: 'aadhaar' | 'mobile';
  @IsString() @IsNotEmpty() identifier!: string;
}

class VerifyOtpDto {
  @IsString() @IsNotEmpty() txnId!: string;
  @IsString() @IsNotEmpty() otp!: string;
}

class LinkAbhaDto {
  @IsString() @IsNotEmpty() abhaAddress!: string;
}

class ConsentRequestDto {
  @IsArray() careContextIds!: string[];
  @IsString() @IsOptional() purpose?: string;
}

class FetchRecordsDto {
  @IsString() @IsNotEmpty() consentId!: string;
}

@Controller('abdm')
export class AbdmController {
  constructor(private abdmService: AbdmService) {}

  @Post('enroll')
  @UseGuards(JwtAuthGuard)
  async enroll(@Request() req: any, @Body() dto: EnrollDto) {
    return this.abdmService.initiateEnrollment(req.user.userId, dto);
  }

  @Post('verify-otp')
  @UseGuards(JwtAuthGuard)
  async verifyOtp(@Request() req: any, @Body() dto: VerifyOtpDto) {
    return this.abdmService.verifyEnrollmentOtp(req.user.userId, dto.txnId, dto.otp);
  }

  @Post('link')
  @UseGuards(JwtAuthGuard)
  async linkAbha(@Request() req: any, @Body() dto: LinkAbhaDto) {
    return this.abdmService.linkExistingAbha(req.user.userId, dto.abhaAddress);
  }

  @Get('discover')
  @UseGuards(JwtAuthGuard)
  async discover(@Request() req: any) {
    return this.abdmService.discoverCareContexts(req.user.userId);
  }

  @Post('consent-request')
  @UseGuards(JwtAuthGuard)
  async requestConsent(@Request() req: any, @Body() dto: ConsentRequestDto) {
    return this.abdmService.requestConsent(
      req.user.userId,
      dto.careContextIds,
      dto.purpose || 'CAREMGT',
    );
  }

  @Post('fetch-records')
  @UseGuards(JwtAuthGuard)
  async fetchRecords(@Request() req: any, @Body() dto: FetchRecordsDto) {
    return this.abdmService.fetchHealthRecords(req.user.userId, dto.consentId);
  }

  // ABDM Webhooks (no auth - validated by ABDM signature)
  @Post('webhook/consent')
  async consentWebhook(@Body() payload: any) {
    await this.abdmService.handleConsentNotification(payload);
    return { status: 'ok' };
  }

  @Post('webhook/data')
  async dataWebhook(@Body() payload: any) {
    await this.abdmService.handleDataNotification(payload);
    return { status: 'ok' };
  }
}
