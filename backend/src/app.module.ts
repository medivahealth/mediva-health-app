import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { HealthModule } from './health/health.module';
import { ChatModule } from './chat/chat.module';
import { RecordsModule } from './records/records.module';
import { DoctorModule } from './doctor/doctor.module';
import { CommonModule } from './common/common.module';
import { AdminModule } from './admin/admin.module';
import { BlogModule } from './blog/blog.module';
import { ContextModule } from './context/context.module';
import { PrescriptionModule } from './prescription/prescription.module';
import { LabModule } from './lab/lab.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/mediva_health',
      }),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    CommonModule,
    AuthModule,
    UserModule,
    HealthModule,
    ChatModule,
    RecordsModule,
    DoctorModule,
    AdminModule,
    BlogModule,
    ContextModule,
    PrescriptionModule,
    LabModule,
    PharmacyModule,
  ],
})
export class AppModule {}
