import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RecordsService } from './records.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('records')
@UseGuards(JwtAuthGuard)
export class RecordsController {
  constructor(private recordsService: RecordsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('description') description?: string,
    @Body('documentMonth') documentMonth?: string,
    @Body('documentYear') documentYear?: string,
    @Body('documentType') documentType?: string,
    @Body('category') category?: string,
    @Body('isRecord') isRecord?: string, // 'true' or 'false' as string from form data
  ) {
    // Convert string 'true'/'false' to boolean, default to false
    const isRecordBool = isRecord === 'true';
    const normalizedType = (documentType || category || '').toString().trim().toLowerCase();
    return this.recordsService.uploadAndProcess(req.user.userId, file, {
      description,
      documentMonth,
      documentYear,
      documentType: normalizedType,
      isRecord: isRecordBool,
    });
  }

  @Get('list')
  async list(@Request() req: any) {
    return this.recordsService.listDocuments(req.user.userId);
  }

  @Get(':id')
  async getDocument(@Request() req: any, @Param('id') id: string) {
    return this.recordsService.getDocument(req.user.userId, id);
  }

  @Put(':id/structured')
  async updateStructured(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.recordsService.updateStructuredData(req.user.userId, id, body);
  }

  @Delete(':id')
  async deleteDocument(@Request() req: any, @Param('id') id: string) {
    await this.recordsService.deleteDocument(req.user.userId, id);
    return { success: true };
  }
}
