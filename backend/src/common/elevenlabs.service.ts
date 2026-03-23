import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger(ElevenLabsService.name);
  private apiKey: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('ELEVENLABS_API_KEY') || '';
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  async streamTextToSpeech(text: string, res: any, lang: string = 'en') {
    if (!this.isConfigured) {
      throw new Error('ElevenLabs API key is not configured');
    }

    const voiceByLanguage: Record<string, string> = {
      en: 'pNInz6obpgDQGcFmaJgB',
      hi: 'pNInz6obpgDQGcFmaJgB',
      mr: 'pNInz6obpgDQGcFmaJgB',
      te: 'pNInz6obpgDQGcFmaJgB',
      bn: 'pNInz6obpgDQGcFmaJgB',
      kn: 'pNInz6obpgDQGcFmaJgB',
      ta: 'pNInz6obpgDQGcFmaJgB',
    };
    const voiceId = voiceByLanguage[lang] || voiceByLanguage.en;
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
    const voiceSettingsByLanguage: Record<string, { similarity_boost: number; stability: number; style: number }> = {
      en: { similarity_boost: 0.85, stability: 0.65, style: 0.3 },
      hi: { similarity_boost: 0.82, stability: 0.7, style: 0.28 },
      mr: { similarity_boost: 0.82, stability: 0.72, style: 0.28 },
      te: { similarity_boost: 0.8, stability: 0.74, style: 0.26 },
      bn: { similarity_boost: 0.81, stability: 0.72, style: 0.27 },
      kn: { similarity_boost: 0.8, stability: 0.74, style: 0.26 },
      ta: { similarity_boost: 0.8, stability: 0.74, style: 0.26 },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: voiceSettingsByLanguage[lang] || voiceSettingsByLanguage.en,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`ElevenLabs API error ${response.status}: ${errText}`);
        throw new Error(`ElevenLabs API returned status ${response.status}: ${errText}`);
      }

      // Read from fetch stream and pipe to express response
      if (response.body) {
        const { Readable } = await import('stream');
        // @ts-ignore - Readable.fromWeb exists in Node 18+
        const stream = Readable.fromWeb(response.body as any);

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Transfer-Encoding', 'chunked');

        stream.pipe(res);

        stream.on('end', () => {
          this.logger.log('TTS stream finished successfully');
        });

        stream.on('error', (err) => {
          this.logger.error(`Stream error: ${err.message}`);
          if (!res.headersSent) {
            res.status(500).send('Audio generation failed');
          }
        });
      } else {
        res.status(500).send('No audio data received');
      }
    } catch (error) {
      this.logger.error(`Error in text-to-speech streaming: ${error}`);
      res.status(500).send('Audio generation failed');
    }
  }
}
