import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { RedisService } from '../common/redis.service';
import { EmailService } from '../common/email.service';
import { User } from '../user/user.schema';

@Injectable()
export class AuthService {
  private snsClient: any = null;
  private snsPublishCommand: any = null;

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private config: ConfigService,
    private redis: RedisService,
    private emailService: EmailService,
  ) {
    const region = this.config.get<string>('AWS_REGION');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    if (region && accessKeyId && secretAccessKey) {
      try {
        // Lazy require keeps build resilient when AWS SDK is optional.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
        this.snsClient = new SNSClient({
          region,
          credentials: { accessKeyId, secretAccessKey },
        });
        this.snsPublishCommand = PublishCommand;
      } catch (err) {
        console.error('AWS SNS SDK not available, falling back to other OTP providers.');
      }
    }
  }

  /* ──────────────── helpers ──────────────── */

  private generateTokens(user: User) {
    const payload = {
      sub: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET', 'refresh-secret'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '30d'),
    });
    return { accessToken, refreshToken };
  }

  /* ──────────────── email / password register ──────────────── */

  async register(
    email: string,
    password: string,
    name?: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.userModel.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (existing.emailVerified) {
        throw new ConflictException('An account with this email already exists');
      }
      // Re-send verification (or auto-verify in dev)
      const isDev = this.config.get('NODE_ENV', 'development') === 'development';
      const token = crypto.randomBytes(32).toString('hex');
      existing.emailVerificationToken = isDev ? '' : token;
      existing.emailVerified = isDev;
      existing.password = await bcrypt.hash(password, 12);
      if (name) existing.name = name;
      await existing.save();
      if (!isDev) {
        await this.emailService.sendVerificationEmail(email, token, name);
      }
      return {
        success: true,
        message: isDev ? 'Account updated! You can now log in.' : 'Verification email re-sent',
      };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hashed = await bcrypt.hash(password, 12);

    // In development, auto-verify for faster testing
    const isDev = this.config.get('NODE_ENV', 'development') === 'development';
    const autoVerify = isDev;

    await this.userModel.create({
      email: email.toLowerCase(),
      password: hashed,
      name: name || '',
      authProvider: 'local',
      emailVerified: autoVerify,
      emailVerificationToken: autoVerify ? '' : token,
      termsAcceptedAt: new Date(),
    });

    if (!autoVerify) {
      await this.emailService.sendVerificationEmail(email, token, name);
    }

    return {
      success: true,
      message: autoVerify
        ? 'Account created! You can now log in.'
        : 'Account created! Check your email to verify.',
    };
  }

  /* ──────────────── resend verification email ──────────────── */

  async resendVerification(email: string): Promise<{ success: boolean; message: string }> {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal whether email exists
      return { success: true, message: 'If an account with that email exists, a verification link has been sent.' };
    }
    if (user.emailVerified) {
      return { success: true, message: 'Your email is already verified. You can log in.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = token;
    await user.save();

    await this.emailService.sendVerificationEmail(email, token, user.name);
    return { success: true, message: 'Verification email sent! Check your inbox.' };
  }

  /* ──────────────── email verification ──────────────── */

  async verifyEmail(token: string): Promise<string> {
    const user = await this.userModel.findOne({
      emailVerificationToken: token,
    });
    if (!user) throw new BadRequestException('Invalid or expired verification link');

    user.emailVerified = true;
    user.emailVerificationToken = '';
    await user.save();

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email, user.name);

    // Return a branded success page
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Mediva – Email Verified</title>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin:0;font-family:'Space Grotesk',sans-serif;background:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:24px;box-sizing:border-box;">
      <div style="max-width:400px;width:100%;text-align:center;">
        <img src="https://d3l60mdhyx2j2v.cloudfront.net/mediva/logo_doctor.png" alt="Mediva" style="width:64px;height:64px;border-radius:14px;margin-bottom:16px;" onerror="this.style.display='none'"/>
        <h1 style="font-size:28px;font-weight:700;color:#111;margin:0 0 6px;letter-spacing:1px;">Mediva</h1>
        <p style="color:#999;font-size:13px;margin:0 0 32px;line-height:20px;">World-Class Care, Absolutely Free<br>Verified by Real Doctors, Today.</p>
        <div style="width:48px;height:48px;border-radius:50%;background:#111;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">
          <span style="color:#fff;font-size:24px;line-height:1;">✓</span>
        </div>
        <h2 style="font-size:20px;font-weight:700;color:#111;margin:0 0 8px;">Email Verified!</h2>
        <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 32px;">Your Mediva account is now active.<br>You can close this page and log in to the app.</p>
        <hr style="border:none;border-top:1px solid #F0F0F0;margin:0 0 20px;">
        <p style="color:#C0C0C0;font-size:11px;">© ${new Date().getFullYear()} Mediva Health Technologies. All rights reserved.</p>
      </div>
    </body>
    </html>`;
  }

  /* ──────────────── email / password login ──────────────── */

  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; isNewUser: boolean }> {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in. Check your inbox.',
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = this.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return { ...tokens, isNewUser: false };
  }

  /* ──────────────── forgot / reset password ──────────────── */

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal whether email exists
      return { success: true, message: 'If an account with that email exists, a reset link has been sent.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    await this.emailService.sendPasswordResetEmail(email, token, user.name);
    return { success: true, message: 'If an account with that email exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const user = await this.userModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetPasswordToken = '';
    user.resetPasswordExpires = null;
    await user.save();

    return { success: true, message: 'Password updated successfully. You can now log in.' };
  }

  /** Serve a branded HTML reset-password page — validates token first */
  async getResetPasswordPage(token: string): Promise<string> {
    const logoUrl = 'https://d3l60mdhyx2j2v.cloudfront.net/mediva/logo_doctor.png';
    const year = new Date().getFullYear();

    // Validate token before showing the form
    const user = await this.userModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      // Token is invalid, expired, or already used — show error page
      return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Mediva – Link Expired</title>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">
      </head>
      <body style="margin:0;font-family:'Space Grotesk',sans-serif;background:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:24px;box-sizing:border-box;">
        <div style="max-width:400px;width:100%;text-align:center;">
          <img src="${logoUrl}" alt="Mediva" style="width:56px;height:56px;border-radius:12px;margin-bottom:12px;" onerror="this.style.display='none'"/>
          <h1 style="font-size:24px;font-weight:700;color:#111;letter-spacing:1px;margin:0 0 4px;">Mediva</h1>
          <p style="color:#999;font-size:13px;margin:0 0 32px;line-height:20px;">World-Class Care, Absolutely Free<br>Verified by Real Doctors, Today.</p>
          <div style="width:48px;height:48px;border-radius:50%;background:#D32F2F;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">
            <span style="color:#fff;font-size:24px;line-height:1;">✕</span>
          </div>
          <h2 style="font-size:20px;font-weight:700;color:#111;margin:0 0 8px;">Link Expired or Already Used</h2>
          <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 32px;">
            This password reset link has expired or has already been used.<br>
            Please go back to the app and request a new reset link via <strong>"Forgot Password"</strong>.
          </p>
          <hr style="border:none;border-top:1px solid #F0F0F0;margin:0 0 20px;">
          <p style="color:#C0C0C0;font-size:11px;">© ${year} Mediva Health Technologies. All rights reserved.</p>
        </div>
      </body>
      </html>`;
    }

    // Token is valid — show the reset form
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Mediva – Reset Password</title>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Space Grotesk',sans-serif; background:#fff; display:flex; justify-content:center; align-items:center; min-height:100vh; padding:24px; }
        .wrap { max-width:400px; width:100%; }
        .header { text-align:center; margin-bottom:32px; }
        .header img { width:56px; height:56px; border-radius:12px; margin-bottom:12px; }
        .header h1 { font-size:24px; font-weight:700; color:#111; letter-spacing:1px; margin-bottom:4px; }
        .header p { color:#999; font-size:13px; }
        .label { display:block; font-size:13px; font-weight:700; color:#333; margin-bottom:6px; margin-top:18px; }
        .label:first-of-type { margin-top:0; }
        .pw-wrap { position:relative; }
        .pw-wrap input { width:100%; padding:14px 48px 14px 16px; border:1px solid #E0E0E0; border-radius:12px; font-size:15px; font-family:'Space Grotesk',sans-serif; color:#111; outline:none; }
        .pw-wrap input:focus { border-color:#999; }
        .eye-btn { position:absolute; right:14px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; padding:4px; display:flex; align-items:center; }
        .eye-btn svg { width:20px; height:20px; fill:none; stroke:#999; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
        .rules { margin-top:8px; padding-left:2px; }
        .rule { display:flex; align-items:center; gap:6px; margin-bottom:3px; font-size:12px; color:#D32F2F; }
        .rule.pass { color:#4CAF50; }
        .rule svg { width:14px; height:14px; flex-shrink:0; }
        .match-row { display:flex; align-items:center; gap:6px; margin-top:6px; padding-left:2px; font-size:12px; }
        .match-row.error { color:#D32F2F; }
        .match-row.ok { color:#4CAF50; }
        .match-row svg { width:14px; height:14px; flex-shrink:0; }
        #msg { display:none; padding:12px 16px; border-radius:10px; font-size:13px; margin-top:16px; }
        .btn { width:100%; padding:14px; border:none; border-radius:12px; background:#111; color:#fff; font-size:16px; font-weight:700; cursor:pointer; font-family:'Space Grotesk',sans-serif; letter-spacing:0.3px; margin-top:24px; }
        .btn:disabled { opacity:0.35; cursor:default; }
        .footer { text-align:center; margin-top:28px; }
        .footer hr { border:none; border-top:1px solid #F0F0F0; margin-bottom:16px; }
        .footer p { color:#C0C0C0; font-size:11px; }
        .confirm { text-align:center; display:none; }
        .confirm .check-circle { width:48px; height:48px; border-radius:50%; background:#111; margin:0 auto 20px; display:flex; align-items:center; justify-content:center; }
        .confirm .check-circle span { color:#fff; font-size:24px; line-height:1; }
        .confirm h2 { font-size:20px; font-weight:700; color:#111; margin-bottom:8px; }
        .confirm p { color:#999; font-size:14px; line-height:1.6; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="header">
          <img src="${logoUrl}" alt="Mediva" onerror="this.style.display='none'"/>
          <h1>Mediva</h1>
          <p>Set a new password</p>
        </div>

        <form id="resetForm">
          <label class="label">New Password</label>
          <div class="pw-wrap">
            <input id="pw" type="password" required placeholder="Enter new password" autocomplete="new-password"/>
            <button type="button" class="eye-btn" onclick="togglePw('pw',this)">
              <svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>

          <div class="rules" id="rules" style="display:none;"></div>

          <label class="label">Confirm Password</label>
          <div class="pw-wrap">
            <input id="cpw" type="password" required placeholder="Re-enter password" autocomplete="new-password"/>
            <button type="button" class="eye-btn" onclick="togglePw('cpw',this)">
              <svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>
          <div id="matchMsg"></div>

          <div id="msg"></div>
          <button type="submit" class="btn" id="submitBtn" disabled>Reset Password</button>
        </form>

        <div class="confirm" id="confirmScreen">
          <div class="check-circle"><span>✓</span></div>
          <h2>Password Reset!</h2>
          <p>Your password has been updated successfully.<br>You can now close this page and log in to the Mediva app with your new password.</p>
        </div>

        <div class="footer">
          <hr/>
          <p>© ${year} Mediva Health Technologies. All rights reserved.</p>
        </div>
      </div>

      <script>
        var eyeOpen = '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
        var eyeClosed = '<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
        var xIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
        var checkIcon = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';

        var rules = [
          { label: 'At least 8 characters', test: function(p){ return p.length >= 8; } },
          { label: 'One uppercase letter', test: function(p){ return /[A-Z]/.test(p); } },
          { label: 'One lowercase letter', test: function(p){ return /[a-z]/.test(p); } },
          { label: 'One number', test: function(p){ return /\\d/.test(p); } },
          { label: 'One special character', test: function(p){ return /[^A-Za-z0-9]/.test(p); } }
        ];

        function togglePw(id, btn) {
          var input = document.getElementById(id);
          if (input.type === 'password') {
            input.type = 'text';
            btn.innerHTML = eyeOpen;
          } else {
            input.type = 'password';
            btn.innerHTML = eyeClosed;
          }
        }

        function validate() {
          var pw = document.getElementById('pw').value;
          var cpw = document.getElementById('cpw').value;
          var rulesEl = document.getElementById('rules');
          var matchEl = document.getElementById('matchMsg');
          var btn = document.getElementById('submitBtn');

          if (pw.length > 0) {
            rulesEl.style.display = 'block';
            var failing = rules.filter(function(r){ return !r.test(pw); });
            var allPass = failing.length === 0;

            if (allPass) {
              rulesEl.innerHTML = '<div class="rule pass">' + checkIcon + ' Strong password</div>';
            } else {
              rulesEl.innerHTML = failing.map(function(r){
                return '<div class="rule">' + xIcon + ' ' + r.label + '</div>';
              }).join('');
            }
          } else {
            rulesEl.style.display = 'none';
          }

          var allRulesPass = rules.every(function(r){ return r.test(pw); });
          if (cpw.length > 0) {
            if (pw === cpw) {
              matchEl.innerHTML = '<div class="match-row ok">' + checkIcon + ' Passwords match</div>';
            } else {
              matchEl.innerHTML = '<div class="match-row error">' + xIcon + ' Passwords do not match</div>';
            }
          } else {
            matchEl.innerHTML = '';
          }

          btn.disabled = !(allRulesPass && pw === cpw && cpw.length > 0);
        }

        document.getElementById('pw').addEventListener('input', validate);
        document.getElementById('cpw').addEventListener('input', validate);

        document.getElementById('resetForm').onsubmit = async function(e) {
          e.preventDefault();
          var pw = document.getElementById('pw').value;
          var msg = document.getElementById('msg');

          try {
            var res = await fetch('/api/auth/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: '${token}', newPassword: pw })
            });
            var data = await res.json();
            if (res.ok) {
              document.getElementById('resetForm').style.display = 'none';
              document.getElementById('confirmScreen').style.display = 'block';
            } else {
              msg.style.display = 'block';
              msg.style.background = '#FFF5F5';
              msg.style.color = '#D32F2F';
              msg.textContent = data.message || 'Something went wrong';
            }
          } catch(err) {
            msg.style.display = 'block';
            msg.style.background = '#FFF5F5';
            msg.style.color = '#D32F2F';
            msg.textContent = 'Network error. Please try again.';
          }
        };
      </script>
    </body>
    </html>`;
  }

  /* ──────────────── Google OAuth ──────────────── */

  async googleLogin(
    idToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; isNewUser: boolean }> {
    // Verify Google ID token (simple approach – decode and trust for now)
    // In production use google-auth-library to verify
    let payload: any;
    try {
      const parts = idToken.split('.');
      payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    const { email, name, sub: googleId } = payload;
    if (!email) throw new UnauthorizedException('Google account has no email');

    let user = await this.userModel.findOne({
      $or: [{ googleId }, { email: email.toLowerCase() }],
    });

    let isNewUser = false;
    if (!user) {
      user = await this.userModel.create({
        email: email.toLowerCase(),
        name: name || '',
        googleId,
        authProvider: 'google',
        emailVerified: true,
        termsAcceptedAt: new Date(),
      });
      isNewUser = true;
    } else {
      if (!user.googleId) user.googleId = googleId;
      if (!user.emailVerified) user.emailVerified = true;
      await user.save();
    }

    const tokens = this.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return { ...tokens, isNewUser };
  }

  /* ──────────────── Apple Sign-In ──────────────── */

  async appleLogin(
    identityToken: string,
    fullName?: string,
  ): Promise<{ accessToken: string; refreshToken: string; isNewUser: boolean }> {
    let payload: any;
    try {
      const parts = identityToken.split('.');
      payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    } catch {
      throw new UnauthorizedException('Invalid Apple token');
    }

    const { email, sub: appleId } = payload;

    let user = await this.userModel.findOne({
      $or: [{ appleId }, ...(email ? [{ email: email.toLowerCase() }] : [])],
    });

    let isNewUser = false;
    if (!user) {
      user = await this.userModel.create({
        email: email ? email.toLowerCase() : '',
        name: fullName || '',
        appleId,
        authProvider: 'apple',
        emailVerified: !!email,
        termsAcceptedAt: new Date(),
      });
      isNewUser = true;
    } else {
      if (!user.appleId) user.appleId = appleId;
      await user.save();
    }

    const tokens = this.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return { ...tokens, isNewUser };
  }

  /* ──────────────── OTP (kept for backward compat) ──────────────── */

  async sendOtp(phone: string): Promise<{ success: boolean; message: string }> {
    const resendKey = `otp_resend:${phone}`;
    const resendLock = await this.redis.get(resendKey);
    if (resendLock) {
      throw new BadRequestException('Please wait 30 seconds before requesting another OTP');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redis.set(`otp:${phone}`, otp, 300);
    await this.redis.set(resendKey, '1', 30);

    const awsSenderId = this.config.get<string>('AWS_SMS_SENDER_ID', 'MEDIVA');
    if (this.snsClient && this.snsPublishCommand) {
      try {
        await this.snsClient.send(new this.snsPublishCommand({
          PhoneNumber: `+91${phone}`,
          Message: `Your Mediva verification code is ${otp}. This code will expire in 5 minutes.`,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
            'AWS.SNS.SMS.SenderID': {
              DataType: 'String',
              StringValue: awsSenderId,
            },
          },
        }));
        return { success: true, message: 'OTP sent successfully' };
      } catch (err) {
        console.error('AWS SNS send error:', err);
      }
    }

    const msg91Key = this.config.get('MSG91_AUTH_KEY', '');
    if (msg91Key && msg91Key !== 'your-msg91-auth-key') {
      try {
        const templateId = this.config.get('MSG91_TEMPLATE_ID', '');
        await fetch('https://control.msg91.com/api/v5/otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authkey: msg91Key },
          body: JSON.stringify({ template_id: templateId, mobile: `91${phone}`, otp }),
        });
      } catch (err) {
        console.error('MSG91 send error:', err);
      }
    } else {
      console.log(`[DEV] OTP for ${phone}: ${otp}`);
    }

    return { success: true, message: 'OTP sent successfully' };
  }

  async verifyOtp(
    phone: string,
    otp: string,
  ): Promise<{ accessToken: string; refreshToken: string; isNewUser: boolean }> {
    const storedOtp = await this.redis.get(`otp:${phone}`);
    const isDev = this.config.get('NODE_ENV') === 'development';
    if (storedOtp !== otp && !(isDev && otp === '123456')) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.redis.del(`otp:${phone}`);

    let user = await this.userModel.findOne({ phone });
    let isNewUser = false;

    if (!user) {
      user = await this.userModel.create({
        phone,
        termsAcceptedAt: new Date(),
      });
      isNewUser = true;
    }

    const tokens = this.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return { ...tokens, isNewUser };
  }

  /* ──────────────── refresh ──────────────── */

  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', 'refresh-secret'),
      });

      const user = await this.userModel.findById(payload.sub);
      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = this.generateTokens(user);
      user.refreshToken = tokens.refreshToken;
      await user.save();

      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /* ──────────────── admin / doctor login ──────────────── */

  async adminLogin(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const adminEmail = this.config.get('ADMIN_EMAIL', 'mediavadmin@mediva.com');
    const adminPw = this.config.get('ADMIN_PASSWORD', 'Mediva@admin');

    if (email !== adminEmail || password !== adminPw) {
      // Also check DB for admin users
      const user = await this.userModel.findOne({
        email: email.toLowerCase(),
        role: 'admin',
      });
      if (!user || !user.password) {
        throw new UnauthorizedException('Invalid admin credentials');
      }
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) throw new UnauthorizedException('Invalid admin credentials');

      const tokens = this.generateTokens(user);
      user.refreshToken = tokens.refreshToken;
      await user.save();
      return tokens;
    }

    // Hard-coded admin — find or create
    let admin = await this.userModel.findOne({ email: adminEmail, role: 'admin' });
    if (!admin) {
      admin = await this.userModel.create({
        email: adminEmail,
        name: 'Mediva Admin',
        role: 'admin',
        emailVerified: true,
        password: await bcrypt.hash(adminPw, 12),
        authProvider: 'local',
      });
    }
    const tokens = this.generateTokens(admin);
    admin.refreshToken = tokens.refreshToken;
    await admin.save();
    return tokens;
  }

  async doctorLogin(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userModel.findOne({
      email: email.toLowerCase(),
      role: 'doctor',
    });
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid doctor credentials');
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException('Your account is not yet activated');
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid doctor credentials');
    }

    const tokens = this.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();
    return tokens;
  }

  /* ──────────────── validate (for JwtStrategy) ──────────────── */

  async validateUser(userId: string): Promise<User | null> {
    return this.userModel.findById(userId);
  }
}
