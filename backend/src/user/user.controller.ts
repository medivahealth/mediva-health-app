import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Body,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { S3Service } from '../common/s3.service';
import { BlogService } from '../blog/blog.service';
import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateProfileDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() preferredLanguage?: string;
  @IsString() @IsOptional() dob?: string;
}

class UpdateConsentDto {
  @IsBoolean() @IsOptional() healthDataCollection?: boolean;
  @IsBoolean() @IsOptional() aiAnalysis?: boolean;
  @IsBoolean() @IsOptional() doctorSharing?: boolean;
  @IsBoolean() @IsOptional() abdmAccess?: boolean;
}

class LifestyleFactorsDto {
  @IsBoolean() @IsOptional() smoking?: boolean;
  @IsBoolean() @IsOptional() alcohol?: boolean;
  @IsString() @IsOptional() exercise?: string;
}

class UpdateHealthHistoryDto {
  @IsArray() @IsString({ each: true }) @IsOptional() allergies?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() chronicConditions?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() currentMedications?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() pastSurgeries?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() familyHistory?: string[];
  @IsString() @IsOptional() bloodType?: string;
  @IsString() @IsOptional() dob?: string;
  @IsString() @IsOptional() gender?: string;
  @IsString() @IsOptional() height?: string;
  @IsString() @IsOptional() weight?: string;
  @ValidateNested() @Type(() => LifestyleFactorsDto) @IsOptional() lifestyleFactors?: LifestyleFactorsDto;
  @IsOptional() completedAt?: Date;
}

class UpdateLocationDto {
  @IsString() @IsOptional() state?: string;
  @IsString() @IsOptional() country?: string;
  @IsOptional() lat?: number | null;
  @IsOptional() lng?: number | null;
  @IsBoolean() consent!: boolean;
}

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private userService: UserService,
    private s3Service: S3Service,
    private blogService: BlogService,
  ) {}

  @Get('profile')
  async getProfile(@Request() req: any) {
    return this.userService.findById(req.user.userId);
  }

  @Put('profile')
  async updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(req.user.userId, dto);
  }

  @Post('profile/image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfileImage(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    let url = '';
    try {
      const key = `profiles/${req.user.userId}/${Date.now()}-${file.originalname}`;
      const result = await this.s3Service.upload(file.buffer, key, file.mimetype);
      url = typeof result === 'string' ? result : (result as any).url;
    } catch {
      // Fallback to inline data URI so profile image still works when S3 credentials are unavailable.
      url = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    }
    await this.userService.updateProfile(req.user.userId, { profileImage: url } as any);
    return { profileImage: url };
  }

  @Get('consent')
  async getConsent(@Request() req: any) {
    return this.userService.getConsent(req.user.userId);
  }

  @Put('consent')
  async updateConsent(@Request() req: any, @Body() dto: UpdateConsentDto) {
    return this.userService.updateConsent(req.user.userId, dto);
  }

  @Post('feedback')
  async sendFeedback(@Request() req: any, @Body() body: { message: string }) {
    return this.blogService.submitFeedback(
      req.user.userId,
      body.message,
      req.user.name || '',
      req.user.email || '',
    );
  }

  @Post('logout-all')
  async logoutAllDevices(@Request() req: any) {
    await this.userService.logoutAllDevices(req.user.userId);
    return { success: true, message: 'Logged out from all devices' };
  }

  @Post('data-export')
  async exportData(@Request() req: any) {
    return this.userService.exportData(req.user.userId);
  }

  @Delete('data')
  async deleteData(@Request() req: any) {
    await this.userService.deleteAllData(req.user.userId);
    return { success: true, message: 'Account data deleted (anonymized)' };
  }

  @Delete('account')
  async deleteAccount(@Request() req: any) {
    await this.userService.softDeleteAccount(req.user.userId);
    return { success: true, message: 'Account deleted' };
  }

  @Get('health-history')
  async getHealthHistory(@Request() req: any) {
    return this.userService.getHealthHistory(req.user.userId);
  }

  @Put('health-history')
  async updateHealthHistory(@Request() req: any, @Body() dto: UpdateHealthHistoryDto) {
    const result = await this.userService.updateHealthHistory(req.user.userId, {
      ...dto,
      completedAt: dto.completedAt || new Date(),
    });
    return { healthHistory: result.healthHistory, success: true };
  }

  @Put('location')
  async updateLocation(@Request() req: any, @Body() dto: UpdateLocationDto) {
    const user = await this.userService.updateLocation(req.user.userId, {
      state: dto.state,
      country: dto.country,
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
      consent: dto.consent,
    });
    return {
      success: true,
      location: {
        state: user.locationState,
        country: user.locationCountry,
        lat: user.locationLat,
        lng: user.locationLng,
        updatedAt: user.locationUpdatedAt,
        consent: user.locationConsent,
      },
    };
  }
}
