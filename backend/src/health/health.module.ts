import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PredictiveAnalyticsService } from './predictive-analytics.service';
import { PredictiveAnalyticsController } from './predictive-analytics.controller';
import { HealthData, HealthDataSchema } from './health.schema';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: HealthData.name, schema: HealthDataSchema }]),
    UserModule,
  ],
  controllers: [HealthController, PredictiveAnalyticsController],
  providers: [HealthService, PredictiveAnalyticsService],
  exports: [HealthService, PredictiveAnalyticsService],
})
export class HealthModule {}
