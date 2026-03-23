import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LabIntegrationService } from './lab-integration.service';
import { LabController } from './lab.controller';

@Module({
  imports: [HttpModule],
  controllers: [LabController],
  providers: [LabIntegrationService],
  exports: [LabIntegrationService],
})
export class LabModule {}
