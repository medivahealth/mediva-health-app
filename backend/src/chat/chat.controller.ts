import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OpenRouterService } from '../common/openrouter.service';
import { GroqSttService } from '../common/groq-stt.service';
import { ElevenLabsService } from '../common/elevenlabs.service';
import { IsString, IsOptional } from 'class-validator';

class SendMessageDto {
  @IsString() message!: string;
  @IsString() @IsOptional() sessionId?: string;
  @IsString() @IsOptional() preferredLanguage?: string;
  @IsOptional() location?: { lat: number; lng: number; city?: string; country?: string };
}

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private chatService: ChatService,
    private openRouter: OpenRouterService,
    private groqStt: GroqSttService,
    private elevenLabs: ElevenLabsService,
  ) {}

  @Post('message')
  async sendMessage(@Request() req: any, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessageWithContext(
      req.user.userId,
      dto.message,
      dto.preferredLanguage || 'en',
      dto.sessionId,
      dto.location,
    );
  }

  @Post('message/stream')
  async sendMessageStream(
    @Request() req: any,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders(); // Send headers immediately

    const stream = this.chatService.sendMessageStream(
      req.user.userId,
      dto.message,
      dto.preferredLanguage || 'en',
      dto.sessionId,
      dto.location,
    );

    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      // Flush each token immediately for real-time streaming
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    }

    res.end();
  }

  @Get('tts')
  async generateSpeech(
    @Query('text') text: string,
    @Query('lang') lang: string,
    @Res() res: Response,
  ) {
    if (!text) {
      return res.status(400).send('Text is required');
    }
    return this.elevenLabs.streamTextToSpeech(text, res, lang || 'en');
  }

  /** Transcription-only endpoint — fast, no AI processing */
  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio'))
  async transcribeAudio(
    @UploadedFile() file: Express.Multer.File,
    @Body('preferredLanguage') preferredLanguage?: string,
  ) {
    let transcription = '';
    if (this.groqStt.isConfigured) {
      transcription = await this.groqStt.transcribe(
        file.buffer,
        preferredLanguage,
        file.originalname || 'audio.wav',
      );
    }
    if (!transcription) {
      try {
        transcription = await this.openRouter.transcribeAudio(
          file.buffer,
          preferredLanguage,
        );
      } catch {
        transcription = '';
      }
    }
    return { transcription };
  }

  @Post('voice')
  @UseInterceptors(FileInterceptor('audio'))
  async voiceMessage(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('sessionId') sessionId?: string,
    @Body('preferredLanguage') preferredLanguage?: string,
  ) {
    // Try Groq Whisper first (free), fallback to OpenRouter
    let transcription = '';
    if (this.groqStt.isConfigured) {
      transcription = await this.groqStt.transcribe(
        file.buffer,
        preferredLanguage,
        file.originalname || 'audio.wav',
      );
    }

    // Fallback to OpenRouter transcription
    if (!transcription) {
      try {
        transcription = await this.openRouter.transcribeAudio(
          file.buffer,
          preferredLanguage,
        );
      } catch {
        transcription = '';
      }
    }

    if (!transcription) {
      return {
        response: "I couldn't understand the audio. Please try again or type your message.",
        severity: 'LOW',
        sessionId: sessionId || '',
        requiresDoctorReview: false,
        transcription: '',
      };
    }

    // Process as regular message
    const result = await this.chatService.sendMessageWithContext(
      req.user.userId,
      transcription,
      preferredLanguage || 'en',
      sessionId,
      (req.body as any).location,
    );

    return { ...result, transcription };
  }

  @Get('history')
  async getHistory(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getHistory(
      req.user.userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('session')
  async getSession(@Request() req: any, @Query('id') id: string) {
    return this.chatService.getSession(req.user.userId, id);
  }

  /** Compact patient + monitoring text for Mediva Voice (WebView) — injected into Gemini Live */
  @Get('voice-brief')
  async voiceBrief(@Request() req: any) {
    return this.chatService.getVoiceBriefForUser(req.user.userId);
  }

  @Post('feedback')
  async messageFeedback(
    @Request() req: any,
    @Body('sessionId') sessionId: string,
    @Body('messageIndex') messageIndex: number,
    @Body('feedback') feedback: 'like' | 'dislike' | '',
  ) {
    return this.chatService.setMessageFeedback(
      req.user.userId,
      sessionId,
      messageIndex,
      feedback,
    );
  }

  @Patch('session/:id/rename')
  async renameSession(
    @Request() req: any,
    @Param('id') id: string,
    @Body('title') title: string,
  ) {
    return this.chatService.renameSession(req.user.userId, id, title);
  }

  @Patch('session/:id/pin')
  async togglePinSession(@Request() req: any, @Param('id') id: string) {
    return this.chatService.togglePinSession(req.user.userId, id);
  }

  @Delete('session/:id')
  async deleteSession(@Request() req: any, @Param('id') id: string) {
    return this.chatService.softDeleteSession(req.user.userId, id);
  }
}
