import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { RagService } from './rag.service';
import { EmergencyService } from './emergency.service';
import { QueryClassifierService } from './query-classifier.service';
import { MultiAgentService } from './multi-agent.service';
import { EvaluationService } from './evaluation.service';
import { ABTestingService } from './ab-testing.service';
import { ContinuousLearningService } from './continuous-learning.service';
import { ContinuousLearningController } from './continuous-learning.controller';
import { IntentClassifierService } from './intent-classifier.service';
import { GeminiVoiceService } from './gemini-voice.service';
import { VoiceGateway } from './voice.gateway';
import { ChatStatusGateway } from './chat-status.gateway';
import { ChatSession, ChatSessionSchema } from './chat.schema';
import { HealthModule } from '../health/health.module';
import { RecordsModule } from '../records/records.module';
import { DoctorModule } from '../doctor/doctor.module';
import { UserModule } from '../user/user.module';
import { CommonModule } from '../common/common.module';
import { ContextModule } from '../context/context.module';
import { AuthModule } from '../auth/auth.module';
import { PrescriptionModule } from '../prescription/prescription.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ChatSession.name, schema: ChatSessionSchema }]),
    HealthModule,
    RecordsModule,
    DoctorModule,
    UserModule,
    CommonModule,
    ContextModule,
    AuthModule,
    forwardRef(() => PrescriptionModule),
  ],
  controllers: [ChatController, ContinuousLearningController],
  providers: [
    ChatService,
    RagService,
    EmergencyService,
    QueryClassifierService,
    MultiAgentService,
    EvaluationService,
    ABTestingService,
    ContinuousLearningService,
    IntentClassifierService,
    GeminiVoiceService,
    VoiceGateway,
    ChatStatusGateway,
  ],
  exports: [ChatService, EvaluationService, ABTestingService, ContinuousLearningService, IntentClassifierService, GeminiVoiceService],
})
export class ChatModule {}
