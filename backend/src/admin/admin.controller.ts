import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { FineTuningService } from './fine-tuning.service';
import { EvaluationService } from '../chat/evaluation.service';
import { ABTestingService } from '../chat/ab-testing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
} from 'class-validator';

/* ─── DTOs ─── */

class SubmitApplicationDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsEmail() @IsNotEmpty() email!: string;
  @IsString() @IsNotEmpty() phone!: string;
  @IsString() @IsOptional() specialization?: string;
  @IsString() @IsOptional() qualification?: string;
  @IsString() @IsOptional() experience?: string;
  @IsString() @IsOptional() registrationNumber?: string;
  @IsString() @IsOptional() bio?: string;
}

class CreateDoctorDto {
  @IsEmail() @IsNotEmpty() email!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsOptional() phone?: string;
}

class UpdateStatusDto {
  @IsString() @IsNotEmpty() status!: string;
  @IsString() @IsOptional() notes?: string;
}

class AssignCaseDto {
  @IsString() @IsNotEmpty() caseId!: string;
  @IsString() @IsNotEmpty() doctorId!: string;
}

/* ─── Helper guard check ─── */
function assertAdmin(req: any) {
  if (req.user?.role !== 'admin') {
    throw new ForbiddenException('Admin access required');
  }
}

@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private fineTuningService: FineTuningService,
    private evaluationService: EvaluationService,
    private abTestingService: ABTestingService,
  ) {}

  /* ── Public: submit doctor application ── */
  @Post('doctor-application')
  async submitApplication(@Body() dto: SubmitApplicationDto) {
    return this.adminService.submitApplication(dto);
  }

  /* ── Protected: admin endpoints ── */

  @Get('applications')
  @UseGuards(JwtAuthGuard)
  async getApplications(@Request() req: any, @Query('status') status?: string) {
    assertAdmin(req);
    return this.adminService.getApplications(status);
  }

  @Get('applications/:id')
  @UseGuards(JwtAuthGuard)
  async getApplication(@Request() req: any, @Param('id') id: string) {
    assertAdmin(req);
    return this.adminService.getApplication(id);
  }

  @Post('applications/:id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    assertAdmin(req);
    return this.adminService.updateApplicationStatus(id, dto.status, dto.notes);
  }

  @Get('doctors')
  @UseGuards(JwtAuthGuard)
  async getDoctors(@Request() req: any) {
    assertAdmin(req);
    return this.adminService.getDoctors();
  }

  @Post('doctors')
  @UseGuards(JwtAuthGuard)
  async createDoctor(@Request() req: any, @Body() dto: CreateDoctorDto) {
    assertAdmin(req);
    return this.adminService.createDoctorAccount(dto);
  }

  @Post('doctors/:id/reset-password')
  @UseGuards(JwtAuthGuard)
  async resetPassword(@Request() req: any, @Param('id') id: string) {
    assertAdmin(req);
    return this.adminService.resetDoctorPassword(id);
  }

  @Delete('doctors/:id')
  @UseGuards(JwtAuthGuard)
  async deleteDoctor(@Request() req: any, @Param('id') id: string) {
    assertAdmin(req);
    return this.adminService.deleteDoctor(id);
  }

  @Get('patient-profile')
  @UseGuards(JwtAuthGuard)
  async getPatientProfile(@Request() req: any, @Query('q') q: string) {
    assertAdmin(req);
    return this.adminService.getPatientProfileByQuery(q);
  }

  @Get('monitoring/doctors')
  @UseGuards(JwtAuthGuard)
  async getDoctorMonitoring(@Request() req: any) {
    assertAdmin(req);
    return this.adminService.getDoctorMonitoring();
  }

  @Post('assign-case')
  @UseGuards(JwtAuthGuard)
  async assignCase(@Request() req: any, @Body() dto: AssignCaseDto) {
    assertAdmin(req);
    return this.adminService.assignCaseToDoctor(dto.caseId, dto.doctorId);
  }

  /* ── Fine-tuning endpoints ── */

  @Post('fine-tuning/collect')
  @UseGuards(JwtAuthGuard)
  async collectData(@Request() req: any, @Body() body: { userId?: string; sessionId?: string }) {
    assertAdmin(req);
    return this.fineTuningService.collectHighQualityPairs(body.userId, body.sessionId);
  }

  @Get('fine-tuning/export')
  @UseGuards(JwtAuthGuard)
  async exportDataset(@Request() req: any, @Query('format') format: 'jsonl' | 'csv' = 'jsonl') {
    assertAdmin(req);
    const data = await this.fineTuningService.exportDataset(format);
    return { data, format, length: data.length };
  }

  @Post('fine-tuning/export-s3')
  @UseGuards(JwtAuthGuard)
  async exportToS3(@Request() req: any, @Query('format') format: 'jsonl' | 'csv' = 'jsonl') {
    assertAdmin(req);
    return this.fineTuningService.exportToS3(format);
  }

  @Get('fine-tuning/stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Request() req: any) {
    assertAdmin(req);
    return this.fineTuningService.getStats();
  }

  /* ── Evaluation endpoints ── */

  @Get('evaluation/stats')
  @UseGuards(JwtAuthGuard)
  async getEvaluationStats(@Request() req: any, @Query('userId') userId?: string) {
    assertAdmin(req);
    return this.evaluationService.getEvaluationStats(userId);
  }

  /* ── A/B Testing endpoints ── */

  @Get('ab-testing/stats')
  @UseGuards(JwtAuthGuard)
  async getABTestStats(@Request() req: any) {
    assertAdmin(req);
    return this.abTestingService.getTestStatistics();
  }

  @Get('ab-testing/best-variant')
  @UseGuards(JwtAuthGuard)
  async getBestVariant(@Request() req: any) {
    assertAdmin(req);
    return this.abTestingService.getBestVariant();
  }

  @Get('ab-testing/variants')
  @UseGuards(JwtAuthGuard)
  async getVariants(@Request() req: any) {
    assertAdmin(req);
    return this.abTestingService.getVariants();
  }
}
