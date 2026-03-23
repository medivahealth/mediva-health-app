import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PatientContextService } from '../context/patient-context.service';
import { IsString, IsBoolean, IsOptional } from 'class-validator';

class ApproveCaseDto {
  @IsString() notes!: string;
  @IsBoolean() approved!: boolean;
}

class DoctorMessageDto {
  @IsString() message!: string;
}

@Controller('doctor')
@UseGuards(JwtAuthGuard)
export class DoctorController {
  constructor(
    private doctorService: DoctorService,
    private patientContextService: PatientContextService,
  ) {}

  @Get('cases')
  async getPendingCases(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.doctorService.getPendingCases(
      req.user.userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('cases/:id')
  async getCaseDetail(@Request() req: any, @Param('id') id: string) {
    return this.doctorService.getCaseDetail(req.user.userId, id);
  }

  @Get('cases/:id/ai-summary')
  async getAiCaseSummary(@Param('id') id: string) {
    return this.doctorService.getAiCaseSummary(id);
  }

  @Post('cases/:id/prescribe')
  async prescribe(
    @Request() req: any,
    @Param('id') id: string,
    @Body('prescription') prescription: any[],
  ) {
    return this.doctorService.signPrescription(id, req.user.userId, prescription);
  }

  @Get('search-patient')
  async searchPatient(@Request() req: any, @Query('q') q: string) {
    return this.doctorService.searchPatient(q);
  }

  @Get('patient-profile')
  async getPatientProfile(@Request() req: any, @Query('q') q: string) {
    return this.doctorService.getPatientProfileByQuery(q);
  }

  @Post('cases/:id/approve')
  async approveCase(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ApproveCaseDto,
  ) {
    return this.doctorService.approveCase(
      req.user.userId,
      id,
      dto.notes,
      dto.approved,
    );
  }

  @Post('cases/:id/message')
  async addMessage(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: DoctorMessageDto,
  ) {
    return this.doctorService.addDoctorMessage(req.user.userId, id, dto.message);
  }

  @Get('stats')
  async getStats(@Request() req: any) {
    return this.doctorService.getDashboardStats(req.user.userId);
  }

  @Post('cases/:id/pick')
  async pickCase(@Request() req: any, @Param('id') id: string) {
    return this.doctorService.pickCase(req.user.userId, id);
  }

  @Get('my-cases')
  async getMyCases(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.doctorService.getMyCases(
      req.user.userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('patients/:id/timeline')
  async getPatientTimeline(@Request() req: any, @Param('id') id: string) {
    // In future we can enforce that this doctor is allowed to see this patient
    return this.patientContextService.getPatientTimeline(id);
  }
}
