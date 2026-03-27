import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PrescriptionController } from './prescription.controller';
import { PrescriptionService } from './prescription.service';
import { Prescription, PrescriptionSchema } from './prescription.schema';
import { ChatSession, ChatSessionSchema } from '../chat/chat.schema';
import { ContextModule } from '../context/context.module';
import { CommonModule } from '../common/common.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Prescription.name, schema: PrescriptionSchema },
      { name: ChatSession.name, schema: ChatSessionSchema },
    ]),
    ContextModule,
    CommonModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [PrescriptionController],
  providers: [PrescriptionService],
  exports: [PrescriptionService],
})
export class PrescriptionModule {}
