import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PharmacyIntegrationService } from './pharmacy-integration.service';
import { PharmacyController } from './pharmacy.controller';

@Module({
  imports: [HttpModule],
  controllers: [PharmacyController],
  providers: [PharmacyIntegrationService],
  exports: [PharmacyIntegrationService],
})
export class PharmacyModule {}
