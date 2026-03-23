import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/user.schema';
import { ChatSession, ChatSessionSchema } from '../chat/chat.schema';
import { HealthData, HealthDataSchema } from '../health/health.schema';
import { PatientContextService } from './patient-context.service';
import { HealthModule } from '../health/health.module';
import { RecordsModule } from '../records/records.module';
import { UserModule } from '../user/user.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: HealthData.name, schema: HealthDataSchema },
    ]),
    HealthModule,
    RecordsModule,
    UserModule,
    CommonModule,
  ],
  providers: [PatientContextService],
  exports: [PatientContextService],
})
export class ContextModule {}
