import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { HealthService, HealthRecord } from './health.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsArray, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class HealthRecordDto {
  @IsString() type!: string;
  value!: any;
  @IsString() @IsOptional() unit?: string;
  @IsString() timestamp!: string;
  @IsString() source!: string;
}

class StoreBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HealthRecordDto)
  records!: HealthRecordDto[];
}

@Controller('health')
@UseGuards(JwtAuthGuard)
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Post('batch')
  async storeBatch(@Request() req: any, @Body() dto: StoreBatchDto) {
    const count = await this.healthService.storeBatch(req.user.userId, dto.records);
    return { success: true, count };
  }

  @Get('timeline')
  async getTimeline(
    @Request() req: any,
    @Query('type') type?: string,
    @Query('source') source?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.healthService.getTimeline(req.user.userId, {
      type,
      source,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('summary')
  async getSummary(@Request() req: any) {
    return this.healthService.getUserHealthSummary(req.user.userId);
  }

  @Get('latest')
  async getLatest(@Request() req: any, @Query('type') type: string) {
    return this.healthService.getLatestByType(req.user.userId, type);
  }
}
