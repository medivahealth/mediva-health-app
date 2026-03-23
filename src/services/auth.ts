/**
 * Auth service – supports email/password, Google, Apple, and OTP login
 */
import api from './api';
import type { AuthTokens, User } from '../types';

class AuthServiceClient {
  /* ── Email / password ── */
  async register(
    email: string,
    password: string,
    name?: string,
  ): Promise<{ success: boolean; message: string }> {
    return api.post('/auth/register', { email, password, name });
  }

  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<AuthTokens> {
    return api.post('/auth/login', { email, password });
  }

  async forgotPassword(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    return api.post('/auth/forgot-password', { email });
  }

  async resendVerification(
    email: string,
  ): Promise<{ success: boolean; message: string }> {
    return api.post('/auth/resend-verification', { email });
  }

  /* ── OAuth ── */
  async googleLogin(idToken: string): Promise<AuthTokens> {
    return api.post('/auth/google', { idToken });
  }

  async appleLogin(
    identityToken: string,
    fullName?: string,
  ): Promise<AuthTokens> {
    return api.post('/auth/apple', { identityToken, fullName });
  }

  /* ── OTP (legacy phone auth) ── */
  async sendOtp(
    phone: string,
  ): Promise<{ success: boolean; message: string }> {
    return api.post('/auth/send-otp', { phone });
  }

  async verifyOtp(phone: string, otp: string): Promise<AuthTokens> {
    return api.post('/auth/verify-otp', { phone, otp });
  }

  /* ── Profile ── */
  async getProfile(): Promise<User> {
    return api.get('/user/profile');
  }

  async updateProfile(data: {
    name?: string;
    email?: string;
    dob?: string;
    preferredLanguage?: string;
  }): Promise<User> {
    return api.put('/user/profile', data);
  }

  async uploadProfileImage(uri: string): Promise<{ profileImage: string }> {
    const filename = uri.split('/').pop() || 'profile.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    return api.uploadFile('/user/profile/image', {
      uri,
      name: filename,
      type: mimeType,
    });
  }
}

export const authService = new AuthServiceClient();
export default authService;
