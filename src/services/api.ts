/**
 * Centralized HTTP client with JWT auth
 * All backend requests go through this service
 */
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { isNgrokUrl, ngrokClientHeaders } from '../utils/ngrok';

/**
 * Dynamically get the API base URL
 * Priority:
 * 1. EXPO_PUBLIC_API_URL environment variable
 * 2. Extract IP from Expo dev server (manifest hostUri)
 * 3. Fallback to localhost for web/simulator
 */
function getBaseUrl(): string {
  // Production — set EXPO_PUBLIC_API_URL in EAS secrets / .env (e.g. https://api.mediva-health.com/api)
  if (!__DEV__) {
    const prod = process.env.EXPO_PUBLIC_API_URL?.trim();
    if (prod) {
      return prod.endsWith('/api') ? prod : `${prod.replace(/\/$/, '')}/api`;
    }
    return 'https://api.mediva-health.com/api';
  }

  // Check for explicit API URL in environment (highest priority)
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envApiUrl && typeof envApiUrl === 'string' && envApiUrl.trim().length > 0) {
    console.log('🔗 Using API URL from environment:', envApiUrl);
    return envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl}/api`;
  }

  // Try to extract IP from Expo dev server
  try {
    // @ts-ignore - hostUri may exist on manifest but not in types
    const hostUri = Constants.expoConfig?.hostUri || (Constants.manifest as any)?.hostUri;
    if (hostUri) {
      // hostUri format: "192.168.1.3:8081" or "192.168.1.3"
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        console.log('🔗 Using API URL from Expo hostUri:', `http://${ip}:3000/api`);
        return `http://${ip}:3000/api`;
      }
    }
  } catch (err) {
    console.warn('Could not extract IP from Expo manifest:', err);
  }

  // Fallback: Use localhost for web/simulator
  // For physical devices, set EXPO_PUBLIC_API_URL in .env
  console.log('🔗 Using fallback API URL: http://localhost:3000/api');
  return 'http://localhost:3000/api';
}

export const BASE_URL = getBaseUrl();
// Base URL without `/api` – useful for WebSocket connections (voice, etc.)
export const API_BASE_URL = BASE_URL.replace(/\/api$/, '');

// Log the API URL in development for debugging
if (__DEV__) {
  console.log(`🔗 API Base URL: ${BASE_URL}`);
  console.log(`💡 To override, set EXPO_PUBLIC_API_URL in your .env file`);
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = BASE_URL;
  }

  /** ngrok free tier: avoid HTML interstitial on API calls */
  private withNgrok(headers: Record<string, string>): Record<string, string> {
    if (!isNgrokUrl(this.baseUrl)) return headers;
    return { ...ngrokClientHeaders(), ...headers };
  }

  private async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync('accessToken');
    } catch {
      return null;
    }
  }

  private async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync('refreshToken');
    } catch {
      return null;
    }
  }

  private async refreshAccessToken(): Promise<string | null> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      await SecureStore.setItemAsync('accessToken', data.accessToken);
      await SecureStore.setItemAsync('refreshToken', data.refreshToken);
      return data.accessToken;
    } catch {
      return null;
    }
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    let token = await this.getToken();

    const headers: Record<string, string> = this.withNgrok({
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    });

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add timeout to prevent hanging requests (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Request timeout — server took too long to respond. Please check your connection and try again.');
      }
      throw new Error(`Network error: ${err.message || 'Unable to connect to server. Please check your internet connection.'}`);
    }
    clearTimeout(timeoutId);

    // If 401, try refreshing token
    if (response.status === 401 && token) {
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 30000);
        try {
          response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers,
            signal: retryController.signal,
          });
        } catch (err: any) {
          clearTimeout(retryTimeoutId);
          if (err.name === 'AbortError') {
            throw new Error('Request timeout — server took too long to respond.');
          }
          throw err;
        }
        clearTimeout(retryTimeoutId);
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    return response.json();
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async uploadFile<T = any>(
    endpoint: string,
    file: { uri: string; name: string; type: string },
    fieldName: string = 'file',
    extraFields?: Record<string, string>,
  ): Promise<T> {
    const token = await this.getToken();
    const formData = new FormData();
    formData.append(fieldName, file as any);

    // Append any extra form fields
    if (extraFields) {
      for (const [key, value] of Object.entries(extraFields)) {
        if (value !== undefined && value !== null) {
          formData.append(key, value);
        }
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.withNgrok({
        Authorization: token ? `Bearer ${token}` : '',
      }),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `Upload Error: ${response.status}`);
    }

    return response.json();
  }

  // SSE streaming for chat using XMLHttpRequest for React Native compatibility
  async streamChat(
    message: string,
    sessionId?: string,
    preferredLanguage?: string,
    onToken: (token: string) => void = () => { },
    onDone: (data: any) => void = () => { },
    onStatus?: (status: string) => void,
    location?: { lat: number; lng: number; city?: string; country?: string },
  ): Promise<void> {
    const token = await this.getToken();
    const url = `${this.baseUrl}/chat/message/stream`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      if (isNgrokUrl(url)) {
        const ng = ngrokClientHeaders();
        Object.entries(ng).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      }

      let lastIndex = 0;
      let capturedSessionId: string | null = null;

      xhr.onprogress = () => {
        const responseText = xhr.responseText;
        const newChunk = responseText.substring(lastIndex);
        lastIndex = responseText.length;

        const lines = newChunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const dataStr = line.slice(6).trim();
              if (!dataStr) continue;

              const event = JSON.parse(dataStr);
              if (event.type === 'token') {
                onToken(event.data);
              } else if (event.type === 'status') {
                onStatus?.(event.data);
              } else if (event.type === 'session') {
                capturedSessionId = event.data;
              } else if (event.type === 'emergency') {
                const emergencyData = JSON.parse(event.data);
                if (!emergencyData.sessionId && capturedSessionId) {
                  emergencyData.sessionId = capturedSessionId;
                }
                onDone({ ...emergencyData, isEmergency: true });
              } else if (event.type === 'done') {
                const doneData = JSON.parse(event.data);
                if (!doneData.sessionId && capturedSessionId) {
                  doneData.sessionId = capturedSessionId;
                }
                onDone(doneData);
              }
            } catch (e) {
              // Ignore partial JSON or malformed lines
            }
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Chat stream error: ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during chat stream.'));
      };

      xhr.send(JSON.stringify({ message, sessionId, preferredLanguage, location }));
    });
  }
}

export const api = new ApiClient();
export default api;
