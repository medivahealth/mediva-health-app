import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecordsController } from './records.controller';
import { RecordsService } from './records.service';
import { OcrService } from './ocr.service';
import { MedicalDocument, MedicalDocumentSchema } from './records.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MedicalDocument.name, schema: MedicalDocumentSchema },
    ]),
  ],
  controllers: [RecordsController],
  providers: [RecordsService, OcrService],
  exports: [RecordsService],
})
export class RecordsModule {}
