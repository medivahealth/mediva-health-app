import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { FineTuningService } from './fine-tuning.service';
import { User, UserSchema } from '../user/user.schema';
import {
  DoctorApplication,
  DoctorApplicationSchema,
} from './doctor-application.schema';
import { ChatSession, ChatSessionSchema } from '../chat/chat.schema';
import { CommonModule } from '../common/common.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: DoctorApplication.name, schema: DoctorApplicationSchema },
      { name: ChatSession.name, schema: ChatSessionSchema },
    ]),
    CommonModule,
    ChatModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, FineTuningService],
  exports: [AdminService],
})
export class AdminModule {}
