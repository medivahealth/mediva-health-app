import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DrugSafetyService } from './drug-safety.service';

class CheckDrugsDto {
  medications: string[] = [];
  conditions?: string[];
  [key: string]: any; // Allow additional properties
}

@Controller('drug-safety')
export class DrugSafetyController {
  constructor(private drugSafety: DrugSafetyService) {}

  @Post('check')
  async checkSafety(@Body() dto: CheckDrugsDto) {
    const alerts = await this.drugSafety.checkDrugSafety(dto.medications);
    const interactions = await this.drugSafety.checkDrugInteractions(dto.medications);
    
    return {
      alerts,
      interactions,
      checkedAt: new Date(),
    };
  }

  @Post('build-context')
  async buildContext(@Body() dto: CheckDrugsDto) {
    const context = await this.drugSafety.buildSafetyContext(
      dto.medications,
      dto.conditions,
    );
    return { context };
  }

  @Get('stats')
  async getStats() {
    return this.drugSafety.getSafetyStats();
  }

  @Post('update-faers')
  async updateDatabase() {
    await this.drugSafety.updateFaersDatabase();
    return { success: true, message: 'FAERS database updated' };
  }
}
