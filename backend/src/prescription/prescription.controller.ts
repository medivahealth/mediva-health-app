import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { PrescriptionService } from './prescription.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrescriptionUrgency } from './prescription.schema';

@Controller('prescription')
@UseGuards(JwtAuthGuard)
export class PrescriptionController {
  constructor(private readonly prescriptionService: PrescriptionService) {}

  /**
   * Patient: Request a prescription
   * Creates AI recommendation and queues for doctor review
   */
  @Post('request')
  async requestPrescription(
    @Request() req: any,
    @Body() body: { symptoms: string; diagnosis: string; chatSessionId?: string },
  ) {
    return this.prescriptionService.generateRecommendation(
      req.user.userId,
      body.symptoms,
      body.diagnosis,
      body.chatSessionId,
    );
  }

  /**
   * Patient: Get my prescriptions
   */
  @Get('my')
  async getMyPrescriptions(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.prescriptionService.getPatientHistory(req.user.userId, { 
      limit: limit ? parseInt(limit, 10) : 20, 
      offset: offset ? parseInt(offset, 10) : 0 
    });
  }

  /**
   * Patient: Get my active medications
   */
  @Get('active-medications')
  async getActiveMedications(@Request() req: any) {
    return this.prescriptionService.getActiveMedications(req.user.userId);
  }

  /**
   * Doctor: Get pending prescription queue
   */
  @Get('queue')
  async getDoctorQueue(
    @Request() req: any,
    @Query('urgency') urgency?: PrescriptionUrgency,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // TODO: Add role check for doctor
    return this.prescriptionService.getPendingQueue({ 
      urgency, 
      limit: limit ? parseInt(limit, 10) : 20, 
      offset: offset ? parseInt(offset, 10) : 0 
    });
  }

  /**
   * Get prescription details by ID
   */
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.prescriptionService.getById(id);
  }

  /**
   * Doctor: Approve prescription
   */
  @Post(':id/approve')
  async approvePrescription(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ) {
    return this.prescriptionService.approve(id, req.user.userId, body.notes);
  }

  /**
   * Doctor: Modify prescription
   */
  @Post(':id/modify')
  async modifyPrescription(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      medications?: any[];
      diagnosis?: string;
      notes?: string;
      reason?: string;
    },
  ) {
    return this.prescriptionService.modify(id, req.user.userId, body);
  }

  /**
   * Doctor: Reject prescription
   */
  @Post(':id/reject')
  async rejectPrescription(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.prescriptionService.reject(id, req.user.userId, body.reason);
  }
}
