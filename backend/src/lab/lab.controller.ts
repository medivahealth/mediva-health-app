import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LabIntegrationService, LabBookingRequest } from './lab-integration.service';

@Controller('lab')
@UseGuards(JwtAuthGuard)
export class LabController {
  constructor(private readonly labService: LabIntegrationService) {}

  @Get('tests')
  getTestCatalog(@Query('category') category?: string) {
    return this.labService.getTestCatalog(category);
  }

  @Get('tests/search')
  searchTests(@Query('q') query: string) {
    return this.labService.searchTests(query);
  }

  @Post('tests/recommend')
  getRecommendedTests(
    @Body() body: { conditions: string[]; symptoms: string[] },
  ) {
    return this.labService.getRecommendedTests(body.conditions, body.symptoms);
  }

  @Post('book')
  bookTests(@Body() request: LabBookingRequest) {
    return this.labService.bookTests(request);
  }

  @Get('booking/:id/status')
  getBookingStatus(@Query('id') bookingId: string) {
    return this.labService.getBookingStatus(bookingId);
  }
}
