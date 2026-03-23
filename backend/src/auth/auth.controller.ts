import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import {
  IsString,
  IsNotEmpty,
  Length,
  IsEmail,
  MinLength,
  IsOptional,
} from 'class-validator';

/* ─── DTOs ─── */

class SendOtpDto {
  @IsString() @IsNotEmpty() @Length(10, 10)
  phone!: string;
}

class VerifyOtpDto {
  @IsString() @IsNotEmpty() @Length(10, 10)
  phone!: string;

  @IsString() @IsNotEmpty() @Length(6, 6)
  otp!: string;
}

class RefreshTokenDto {
  @IsString() @IsNotEmpty()
  refreshToken!: string;
}

class RegisterDto {
  @IsEmail() @IsNotEmpty()
  email!: string;

  @IsString() @MinLength(8)
  password!: string;

  @IsString() @IsOptional()
  name?: string;
}

class LoginDto {
  @IsEmail() @IsNotEmpty()
  email!: string;

  @IsString() @IsNotEmpty()
  password!: string;
}

class ForgotPasswordDto {
  @IsEmail() @IsNotEmpty()
  email!: string;
}

class ResetPasswordDto {
  @IsString() @IsNotEmpty()
  token!: string;

  @IsString() @MinLength(8)
  newPassword!: string;
}

class GoogleLoginDto {
  @IsString() @IsNotEmpty()
  idToken!: string;
}

class AppleLoginDto {
  @IsString() @IsNotEmpty()
  identityToken!: string;

  @IsString() @IsOptional()
  fullName?: string;
}

class AdminLoginDto {
  @IsEmail() @IsNotEmpty()
  email!: string;

  @IsString() @IsNotEmpty()
  password!: string;
}

class DoctorLoginDto {
  @IsEmail() @IsNotEmpty()
  email!: string;

  @IsString() @IsNotEmpty()
  password!: string;
}

/* ─── Controller ─── */

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /* ── OTP (legacy / phone auth) ── */

  @Post('send-otp')
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.otp);
  }

  /* ── Email / password ── */

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.name);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    return this.authService.loginWithPassword(dto.email, dto.password);
  }

  /* ── Resend verification email ── */

  @Post('resend-verification')
  async resendVerification(@Body() dto: ForgotPasswordDto) {
    return this.authService.resendVerification(dto.email);
  }

  /* ── Email verification (GET – clicked from email) ── */

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string, @Res() res: Response) {
    const html = await this.authService.verifyEmail(token);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  /* ── Forgot / reset password ── */

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Get('reset-password-page')
  async resetPasswordPage(@Query('token') token: string, @Res() res: Response) {
    const html = await this.authService.getResetPasswordPage(token);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  /* ── OAuth ── */

  @Post('google')
  async googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto.idToken);
  }

  @Post('apple')
  async appleLogin(@Body() dto: AppleLoginDto) {
    return this.authService.appleLogin(dto.identityToken, dto.fullName);
  }

  /* ── Refresh ── */

  @Post('refresh')
  async refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  /* ── Admin / Doctor login ── */

  @Post('admin/login')
  @HttpCode(200)
  async adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto.email, dto.password);
  }

  @Post('doctor/login')
  @HttpCode(200)
  async doctorLogin(@Body() dto: DoctorLoginDto) {
    return this.authService.doctorLogin(dto.email, dto.password);
  }
}
