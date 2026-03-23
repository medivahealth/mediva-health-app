import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AbdmController } from './abdm.controller';
import { AbdmService } from './abdm.service';
import { User, UserSchema } from '../user/user.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [AbdmController],
  providers: [AbdmService],
  exports: [AbdmService],
})
export class AbdmModule {}
