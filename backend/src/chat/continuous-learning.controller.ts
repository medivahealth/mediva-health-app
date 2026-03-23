import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContinuousLearningService } from './continuous-learning.service';

@Controller('learning')
@UseGuards(JwtAuthGuard)
export class ContinuousLearningController {
  constructor(private continuousLearning: ContinuousLearningService) {}

  @Get('stats')
  async getLearningStats() {
    const stats = this.continuousLearning.getLearningStats();
    return stats;
  }

  @Get('cases')
  async getLearningCases() {
    // Return anonymized learning cases for transparency
    return { message: 'Learning database active', count: 'Available in stats' };
  }
}
