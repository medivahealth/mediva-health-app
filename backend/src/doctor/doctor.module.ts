import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DoctorController } from './doctor.controller';
import { DoctorService } from './doctor.service';
import { ChatSession, ChatSessionSchema } from '../chat/chat.schema';
import { User, UserSchema } from '../user/user.schema';
import { ContinuousLearningService } from '../chat/continuous-learning.service';
import { ContextModule } from '../context/context.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ContextModule,
  ],
  controllers: [DoctorController],
  providers: [DoctorService, ContinuousLearningService],
  exports: [DoctorService],
})
export class DoctorModule {}
