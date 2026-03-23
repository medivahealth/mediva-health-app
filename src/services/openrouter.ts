import { Message } from './voice-conversation';

export default class OpenRouter {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    // For React Native, we'll read from environment or use backend directly
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = process.env.MEDIVA_BACKEND_URL 
      ? `${process.env.MEDIVA_BACKEND_URL}/api/chat/message`
      : 'http://192.168.3.137:3000/api/chat/message'; // Your local backend IP
    
    if (!this.apiKey) {
      console.log('OpenRouter API key not configured. Using Mediva backend directly.');
    }
  }

  async chat(messages: Message[]): Promise<string> {
    // If we have OpenRouter API key, use OpenRouter directly
    if (this.apiKey) {
      return this.chatWithOpenRouter(messages);
    }
    
    // Otherwise, use Mediva backend which has OpenRouter integration
    return this.chatWithMedivaBackend(messages);
  }

  private async chatWithOpenRouter(messages: Message[]): Promise<string> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://mediva.ai',
          'X-Title': 'Mediva Voice Agent'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet', // Or user's preferred model
          messages: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          max_tokens: 300, // Keep responses concise for voice
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'I apologize, I could not process that.';
    } catch (error) {
      console.error('OpenRouter chat error:', error);
      throw error;
    }
  }

  private async chatWithMedivaBackend(messages: Message[]): Promise<string> {
    try {
      // Extract last user message
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (!lastUserMessage) {
        return 'Hello! How can I help you with your health today?';
      }

      // Get conversation history (last 5 exchanges)
      const history = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: lastUserMessage.content,
          history: history,
          sessionId: 'voice-session-' + Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Mediva backend error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || data.message || 'I understand. Please tell me more.';
    } catch (error) {
      console.error('Mediva backend chat error:', error);
      throw error;
    }
  }
}
