import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenRouterService } from './openrouter.service';
import { PineconeService } from './pinecone.service';
import { S3Service } from './s3.service';
import { RedisService } from './redis.service';
import { EmailService } from './email.service';
import { GroqSttService } from './groq-stt.service';
import { WebSearchService } from './web-search.service';
import { ElevenLabsService } from './elevenlabs.service';
import { DrugSafetyService } from './drug-safety.service';
import { DrugSafetyController } from './drug-safety.controller';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    OpenRouterService,
    PineconeService,
    S3Service,
    RedisService,
    EmailService,
    GroqSttService,
    WebSearchService,
    ElevenLabsService,
    DrugSafetyService,
  ],
  controllers: [DrugSafetyController],
  exports: [
    OpenRouterService,
    PineconeService,
    S3Service,
    RedisService,
    EmailService,
    GroqSttService,
    WebSearchService,
    ElevenLabsService,
    DrugSafetyService,
  ],
})
export class CommonModule {}
