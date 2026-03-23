import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export enum ModelTier {
  FAST = 'fast',
  REASONING = 'reasoning',
  INDIAN_LANG = 'indian_lang',
  TRANSCRIPTION = 'transcription',
}

const MODEL_MAP: Record<ModelTier, string> = {
  [ModelTier.FAST]: 'anthropic/claude-3-haiku',
  [ModelTier.REASONING]: 'anthropic/claude-3.5-sonnet',
  [ModelTier.INDIAN_LANG]: 'google/gemini-1.5-flash', // Fixed: valid OpenRouter model ID
  [ModelTier.TRANSCRIPTION]: 'openai/whisper-large-v3',
};

@Injectable()
export class OpenRouterService {
  private client: OpenAI;
  private readonly isConfigured: boolean;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get('OPENROUTER_API_KEY', '');
    this.isConfigured = !!apiKey;

    this.client = new OpenAI({
      baseURL: this.config.get('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
      apiKey: apiKey || 'not-configured',
      defaultHeaders: {
        'HTTP-Referer': 'https://www.mediva-health.com',
        'X-Title': 'Mediva Health',
      },
    });

    if (!this.isConfigured) {
      console.warn('[OpenRouter] API key not set — chat will return placeholder responses. Set OPENROUTER_API_KEY in .env');
    }
  }

  async chat(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    tier: ModelTier = ModelTier.FAST,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    if (!this.isConfigured) {
      return '⚠️ AI chat is not configured yet. Please set OPENROUTER_API_KEY in the backend .env file to enable AI responses.\n\nSeverity: LOW';
    }

    const completion = await this.client.chat.completions.create({
      model: MODEL_MAP[tier],
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 2048,
    });

    return completion.choices[0]?.message?.content || '';
  }

  async chatStream(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    tier: ModelTier = ModelTier.FAST,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    if (!this.isConfigured) {
      // Return a mock stream with a single message
      async function* mockStream(): AsyncGenerator<OpenAI.Chat.Completions.ChatCompletionChunk> {
        yield {
          id: 'mock',
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: 'not-configured',
          choices: [{
            index: 0,
            delta: { content: '⚠️ AI chat not configured. Set OPENROUTER_API_KEY in .env\n\nSeverity: LOW' },
            finish_reason: 'stop',
            logprobs: null,
          }],
        } as any;
      }
      return mockStream();
    }

    const stream = await this.client.chat.completions.create({
      model: MODEL_MAP[tier],
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 2048,
      stream: true,
    });

    return stream;
  }

  async createEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'openai/text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  }

  async transcribeAudio(audioBuffer: Buffer, language?: string): Promise<string> {
    // OpenRouter doesn't directly support Whisper file uploads,
    // so we use the OpenAI Whisper endpoint directly or a proxy
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', 'whisper-1');
    if (language) formData.append('language', language);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.get('OPENROUTER_API_KEY')}`,
      },
      body: formData,
    });

    const data = await response.json();
    return data.text || '';
  }

  getModelForTier(tier: ModelTier): string {
    return MODEL_MAP[tier];
  }
}
