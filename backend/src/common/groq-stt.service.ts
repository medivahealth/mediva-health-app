/**
 * Groq Whisper STT Service — FREE Speech-to-Text
 * Uses Groq's whisper-large-v3-turbo model for fast transcription
 * Fallback: returns empty string if Groq key not set
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GroqSttService {
  private readonly logger = new Logger(GroqSttService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.groq.com/openai/v1/audio/transcriptions';

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('GROQ_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn('GROQ_API_KEY not set — Speech-to-Text will use OpenRouter fallback');
    } else {
      this.logger.log('Groq Whisper STT configured ✓');
    }
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Transcribe audio buffer using Groq Whisper
   * @param audioBuffer Raw audio data
   * @param language Optional ISO language code (e.g. 'en', 'hi', 'te')
   * @returns Transcribed text
   */
  async transcribe(
    audioBuffer: Buffer,
    language?: string,
    fileName: string = 'audio.wav',
  ): Promise<string> {
    if (!this.apiKey) {
      this.logger.warn('Groq STT not configured, returning empty');
      return '';
    }

    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/wav' });
      formData.append('file', blob, fileName);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('response_format', 'json');
      if (language) formData.append('language', language);

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`Groq STT error ${response.status}: ${errText}`);
        return '';
      }

      const data = await response.json();
      return data.text || '';
    } catch (err: any) {
      this.logger.error(`Groq STT failed: ${err.message}`);
      return '';
    }
  }
}
