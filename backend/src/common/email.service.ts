import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/* ─── Shared email styles ─── */
const FONT_LINK = `<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">`;
const BODY_STYLE = `margin:0;font-family:'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#ffffff;padding:40px 0;`;
const WRAPPER_STYLE = `max-width:480px;margin:0 auto;background:#ffffff;padding:40px 32px;`;
const LOGO_URL = `https://d3l60mdhyx2j2v.cloudfront.net/mediva/logo_doctor.png`;

function emailHeader(): string {
  return `
    <div style="text-align:center;margin-bottom:28px;">
      <img src="${LOGO_URL}" alt="Mediva" style="width:48px;height:48px;border-radius:10px;margin-bottom:10px;" onerror="this.style.display='none'"/>
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#111;letter-spacing:1px;">Mediva</h1>
      <p style="margin:4px 0 0;color:#999;font-size:12px;line-height:18px;">World-Class Care, Absolutely Free<br>Verified by Real Doctors, Today.</p>
    </div>`;
}

function emailFooter(): string {
  return `
    <hr style="border:none;border-top:1px solid #F0F0F0;margin:28px 0 16px;">
    <p style="color:#C0C0C0;font-size:11px;text-align:center;margin:0;">
      © ${new Date().getFullYear()} Mediva Health Technologies. All rights reserved.
    </p>`;
}

function emailButton(href: string, label: string): string {
  return `
    <div style="text-align:center;margin:28px 0;">
      <a href="${href}" style="display:inline-block;padding:14px 40px;background:#111;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;font-family:'Space Grotesk',sans-serif;letter-spacing:0.3px;">
        ${label}
      </a>
    </div>`;
}

function wrapEmail(content: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${FONT_LINK}</head>
  <body style="${BODY_STYLE}">
    <div style="${WRAPPER_STYLE}">
      ${emailHeader()}
      ${content}
      ${emailFooter()}
    </div>
  </body>
  </html>`;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fromEmail: string;

  constructor(private config: ConfigService) {
    this.fromEmail = this.config.get('GMAIL_USER', 'team@eco-dispose.com');

    const clientId = this.config.get('GMAIL_CLIENT_ID', '');
    const clientSecret = this.config.get('GMAIL_CLIENT_SECRET', '');
    const refreshToken = this.config.get('GMAIL_REFRESH_TOKEN', '');
    const redirectUri = this.config.get(
      'GMAIL_REDIRECT_URI',
      'https://developers.google.com/oauthplayground',
    );

    if (clientId && clientSecret && refreshToken) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          type: 'OAuth2',
          user: this.fromEmail,
          clientId,
          clientSecret,
          refreshToken,
        },
      } as any);
      
      this.transporter.verify((error, success) => {
        if (error) {
          this.logger.error('Email transporter verification failed:', error);
        } else {
          this.logger.log('Email transporter verified and ready to send');
        }
      });
      this.logger.log('Email service configured with Gmail OAuth2');
    } else {
      this.logger.warn(
        'Gmail credentials not set — emails will be logged to console only',
      );
    }
  }

  /** Send a raw email */
  async send(to: string, subject: string, html: string): Promise<void> {
    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: `"Mediva" <${this.fromEmail}>`,
          to,
          subject,
          html,
        });
        this.logger.log(`Email successfully sent to ${to} (MessageId: ${info.messageId})`);
      } catch (err: any) {
        this.logger.error(`Failed to send email to ${to}: ${err.message}`);
        if (err.response) this.logger.error(`SMTP Response: ${err.response}`);
        this.logger.log(`[FALLBACK LOGGING] To: ${to} | Subject: ${subject}`);
        this.logger.log(`Preview of link in failed email: ${html.match(/href="([^"]+)"/)?.[1] || 'No link found'}`);
      }
    } else {
      this.logger.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}`);
      this.logger.log(html);
    }
  }

  /** Email verification link */
  async sendVerificationEmail(
    email: string,
    token: string,
    name?: string,
  ): Promise<void> {
    const verifyUrl = `${this.config.get('BACKEND_URL', 'http://localhost:3000')}/api/auth/verify-email?token=${token}`;

    const html = wrapEmail(`
      <h2 style="font-size:18px;font-weight:700;color:#111;margin:0 0 8px;">Verify your email</h2>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 4px;">
        Hi ${name || 'there'},
      </p>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0;">
        Thank you for signing up with <strong style="color:#111;">Mediva</strong>. Click the button below to verify your email address and get started.
      </p>
      ${emailButton(verifyUrl, 'Verify Email')}
      <p style="color:#C0C0C0;font-size:12px;line-height:1.5;margin:0 0 16px;">
        Or copy this link:<br>
        <a href="${verifyUrl}" style="color:#999;word-break:break-all;text-decoration:underline;">${verifyUrl}</a>
      </p>
      <p style="color:#C0C0C0;font-size:12px;margin:0;">Didn't receive this email? Check your spam folder, or use the "Resend" option in the app to get a new link.</p>
    `);

    await this.send(email, 'Verify your Mediva account', html);
  }

  /** Password reset link */
  async sendPasswordResetEmail(
    email: string,
    token: string,
    name?: string,
  ): Promise<void> {
    const resetUrl = `${this.config.get('BACKEND_URL', 'http://localhost:3000')}/api/auth/reset-password-page?token=${token}`;

    const html = wrapEmail(`
      <h2 style="font-size:18px;font-weight:700;color:#111;margin:0 0 8px;">Reset your password</h2>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 4px;">
        Hi ${name || 'there'},
      </p>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0;">
        We received a request to reset your Mediva password. Click the button below to set a new password.
      </p>
      ${emailButton(resetUrl, 'Reset Password')}
      <p style="color:#C0C0C0;font-size:12px;line-height:1.5;margin:0;">This link expires in 1 hour. If you didn't request a reset, please ignore this email.<br>Didn't receive it? Check your spam folder, or use the "Resend" option in the app.</p>
    `);

    await this.send(email, 'Reset your Mediva password', html);
  }

  /** Welcome email after verification */
  async sendWelcomeEmail(email: string, name?: string): Promise<void> {
    const html = wrapEmail(`
      <h2 style="font-size:18px;font-weight:700;color:#111;margin:0 0 12px;">Welcome to Mediva!</h2>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 8px;">
        Hi ${name || 'there'},
      </p>
      <p style="color:#999;font-size:14px;line-height:1.7;margin:0 0 16px;">
        Your email is verified and your Mediva account is ready.
      </p>
      <p style="color:#999;font-size:14px;line-height:1.7;margin:0;">
        Experience world-class care, absolutely free — verified by real doctors, today. 
        Connect your wearables, explore AI-powered health insights, and get personalised advice from verified medical professionals.
      </p>
    `);

    await this.send(email, 'Welcome to Mediva!', html);
  }

  /** Notify admin about doctor application */
  async sendDoctorApplicationNotification(
    adminEmail: string,
    doctorName: string,
    doctorEmail: string,
  ): Promise<void> {
    const html = wrapEmail(`
      <h2 style="font-size:18px;font-weight:700;color:#111;margin:0 0 8px;">New Doctor Application</h2>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 16px;">
        <strong style="color:#111;">${doctorName}</strong> (${doctorEmail}) has applied to join Mediva as a doctor.
      </p>
      <div style="background:#FAFAFA;border-radius:12px;padding:16px 20px;margin:0 0 8px;">
        <p style="margin:0 0 4px;color:#C0C0C0;font-size:12px;">Name</p>
        <p style="margin:0 0 12px;color:#111;font-weight:600;font-size:14px;">${doctorName}</p>
        <p style="margin:0 0 4px;color:#C0C0C0;font-size:12px;">Email</p>
        <p style="margin:0;color:#111;font-weight:600;font-size:14px;">${doctorEmail}</p>
      </div>
      <p style="color:#999;font-size:13px;line-height:1.5;margin:16px 0 0;">
        Log into the admin panel to review and create their credentials.
      </p>
    `);

    await this.send(adminEmail, `New Doctor Application: ${doctorName}`, html);
  }

  /** Send doctor credentials */
  async sendDoctorCredentials(
    email: string,
    password: string,
    name: string,
  ): Promise<void> {
    const html = wrapEmail(`
      <h2 style="font-size:18px;font-weight:700;color:#111;margin:0 0 8px;">Welcome, Dr. ${name}!</h2>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 16px;">
        Your Mediva doctor account has been created. Here are your login credentials:
      </p>
      <div style="background:#FAFAFA;border-radius:12px;padding:20px;margin:0 0 16px;">
        <p style="margin:0 0 4px;color:#C0C0C0;font-size:12px;">Email</p>
        <p style="margin:0 0 14px;color:#111;font-weight:700;font-size:14px;">${email}</p>
        <p style="margin:0 0 4px;color:#C0C0C0;font-size:12px;">Temporary Password</p>
        <p style="margin:0;color:#111;font-weight:700;font-size:14px;">${password}</p>
      </div>
      <p style="color:#D32F2F;font-size:12px;margin:0;">Please change your password after first login.</p>
    `);

    await this.send(email, 'Your Mediva Doctor Account', html);
  }
}
