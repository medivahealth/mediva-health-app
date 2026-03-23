import { Controller, Get, Post, Body, Query, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PharmacyIntegrationService, PrescriptionOrder } from './pharmacy-integration.service';

@Controller('pharmacy')
@UseGuards(JwtAuthGuard)
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyIntegrationService) {}

  @Get('medicines/search')
  searchMedicines(
    @Query('q') query: string,
    @Query('pincode') pincode?: string,
  ) {
    return this.pharmacyService.searchMedicines(query, pincode);
  }

  @Get('nearby')
  findNearby(
    @Query('lat') latitude: number,
    @Query('lng') longitude: number,
    @Query('radius') radiusKm?: number,
  ) {
    return this.pharmacyService.findNearbyPharmacies(latitude, longitude, radiusKm);
  }

  @Post('order')
  placeOrder(@Body() order: PrescriptionOrder) {
    return this.pharmacyService.placeOrder(order);
  }

  @Get('order/:id/status')
  getOrderStatus(@Param('id') orderId: string) {
    return this.pharmacyService.getOrderStatus(orderId);
  }

  @Get('medicines/:id/substitutes')
  getSubstitutes(@Param('id') medicineId: string) {
    return this.pharmacyService.getSubstitutes(medicineId);
  }

  @Post('calculate')
  calculateTotal(
    @Body() body: { medicines: { medicineId: string; quantity: number }[] },
  ) {
    return this.pharmacyService.calculateTotal(body.medicines);
  }
}
