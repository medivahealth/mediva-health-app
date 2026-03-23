import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { firstValueFrom } from 'rxjs';

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  manufacturer: string;
  dosageForm: string;
  strength: string;
  packageSize: string;
  mrp: number;
  discountedPrice?: number;
  isScheduleH: boolean;
  isScheduleH1: boolean;
  requiresPrescription: boolean;
  inStock: boolean;
  substitutes?: Medicine[];
}

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  phone: string;
  distanceKm: number;
  isOpen: boolean;
  rating: number;
  deliveryAvailable: boolean;
  deliveryTimeMinutes: number;
  licenseNumber: string;
}

export interface PrescriptionOrder {
  prescriptionId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  deliveryAddress: string;
  medicines: {
    medicineId: string;
    quantity: number;
    dosage?: string;
  }[];
  pharmacyId?: string;
  paymentMethod: 'cod' | 'online' | 'insurance';
}

export interface OrderResponse {
  orderId: string;
  status: 'confirmed' | 'pending' | 'pharmacy_notified';
  pharmacyName?: string;
  pharmacyPhone?: string;
  estimatedDelivery?: Date;
  totalAmount: number;
  deliveryCharge: number;
  trackingUrl?: string;
}

export interface OrderStatus {
  orderId: string;
  status: 
    | 'placed'
    | 'confirmed'
    | 'preparing'
    | 'packed'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled';
  timeline: OrderEvent[];
  deliveryAgent?: {
    name: string;
    phone: string;
  };
}

export interface OrderEvent {
  timestamp: Date;
  status: string;
  message: string;
}

@Injectable()
export class PharmacyIntegrationService {
  private readonly logger = new Logger(PharmacyIntegrationService.name);

  // Pharmacy partner configurations
  private readonly pharmacyPartners = {
    netmeds: {
      name: 'Netmeds',
      baseUrl: process.env.NETMEDS_API_URL || 'https://api.netmeds.com',
      apiKey: process.env.NETMEDS_API_KEY,
    },
    pharmeasy: {
      name: 'PharmEasy',
      baseUrl: process.env.PHARMEASY_API_URL || 'https://api.pharmeasy.in',
      apiKey: process.env.PHARMEASY_API_KEY,
    },
    local: {
      name: 'Local Pharmacy Network',
      baseUrl: process.env.LOCAL_PHARMACY_API_URL,
      apiKey: process.env.LOCAL_PHARMACY_API_KEY,
    },
  };

  constructor(private readonly httpService: HttpService) {}

  /**
   * Search for medicines across pharmacy partners
   */
  async searchMedicines(query: string, pincode?: string): Promise<Medicine[]> {
    this.logger.log(`Searching medicines: ${query}`);

    // In production, call pharmacy partner APIs
    // For now, return mock data
    const mockMedicines: Medicine[] = [
      {
        id: 'MED001',
        name: 'Dolo 650',
        genericName: 'Paracetamol',
        manufacturer: 'Micro Labs',
        dosageForm: 'Tablet',
        strength: '650mg',
        packageSize: '15 tablets',
        mrp: 35,
        discountedPrice: 28,
        isScheduleH: false,
        isScheduleH1: false,
        requiresPrescription: false,
        inStock: true,
      },
      {
        id: 'MED002',
        name: 'Azithral 500',
        genericName: 'Azithromycin',
        manufacturer: 'Alembic',
        dosageForm: 'Tablet',
        strength: '500mg',
        packageSize: '5 tablets',
        mrp: 120,
        discountedPrice: 98,
        isScheduleH: true,
        isScheduleH1: false,
        requiresPrescription: true,
        inStock: true,
      },
      {
        id: 'MED003',
        name: 'Metformin 500',
        genericName: 'Metformin Hydrochloride',
        manufacturer: 'USV',
        dosageForm: 'Tablet',
        strength: '500mg',
        packageSize: '10 tablets',
        mrp: 45,
        discountedPrice: 38,
        isScheduleH: true,
        isScheduleH1: false,
        requiresPrescription: true,
        inStock: true,
        substitutes: [
          {
            id: 'MED003A',
            name: 'Glycomet 500',
            genericName: 'Metformin Hydrochloride',
            manufacturer: 'USV',
            dosageForm: 'Tablet',
            strength: '500mg',
            packageSize: '10 tablets',
            mrp: 42,
            discountedPrice: 35,
            isScheduleH: true,
            isScheduleH1: false,
            requiresPrescription: true,
            inStock: true,
          },
        ],
      },
    ];

    return mockMedicines.filter(m => 
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.genericName.toLowerCase().includes(query.toLowerCase())
    );
  }

  /**
   * Find nearby pharmacies
   */
  async findNearbyPharmacies(latitude: number, longitude: number, radiusKm: number = 5): Promise<Pharmacy[]> {
    this.logger.log(`Finding pharmacies near ${latitude},${longitude}`);

    // Mock nearby pharmacies
    return [
      {
        id: 'PHARM001',
        name: 'Apollo Pharmacy',
        address: '123 Main Road, Near City Center',
        phone: '+91-98765-43210',
        distanceKm: 0.8,
        isOpen: true,
        rating: 4.5,
        deliveryAvailable: true,
        deliveryTimeMinutes: 30,
        licenseNumber: 'DL-PH-12345',
      },
      {
        id: 'PHARM002',
        name: 'MedPlus',
        address: '456 Market Street, Sector 12',
        phone: '+91-98765-43211',
        distanceKm: 1.2,
        isOpen: true,
        rating: 4.2,
        deliveryAvailable: true,
        deliveryTimeMinutes: 45,
        licenseNumber: 'DL-PH-12346',
      },
      {
        id: 'PHARM003',
        name: 'Guardian Pharmacy',
        address: '789 Health Complex, Block B',
        phone: '+91-98765-43212',
        distanceKm: 2.5,
        isOpen: false,
        rating: 4.0,
        deliveryAvailable: false,
        deliveryTimeMinutes: 0,
        licenseNumber: 'DL-PH-12347',
      },
    ];
  }

  /**
   * Place prescription order
   */
  async placeOrder(order: PrescriptionOrder): Promise<OrderResponse> {
    this.logger.log(`Placing prescription order for ${order.patientId}`);

    // Validate prescription is approved
    // const prescription = await this.prescriptionService.getById(order.prescriptionId);
    // if (prescription.status !== 'approved' && prescription.status !== 'modified') {
    //   throw new Error('Prescription must be approved before ordering');
    // }

    // Calculate totals
    const mockMedicines = await this.searchMedicines('');
    let subtotal = 0;
    for (const item of order.medicines) {
      const med = mockMedicines.find(m => m.id === item.medicineId);
      if (med) {
        subtotal += (med.discountedPrice || med.mrp) * item.quantity;
      }
    }
    const deliveryCharge = subtotal > 500 ? 0 : 40;
    const totalAmount = subtotal + deliveryCharge;

    // Simulate order placement
    const orderId = `ORD${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    return {
      orderId,
      status: 'confirmed',
      pharmacyName: 'Apollo Pharmacy',
      pharmacyPhone: '+91-98765-43210',
      estimatedDelivery: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
      totalAmount,
      deliveryCharge,
      trackingUrl: `https://mediva.ai/track/order/${orderId}`,
    };
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    // Simulate order status
    return {
      orderId,
      status: 'out_for_delivery',
      timeline: [
        { timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), status: 'placed', message: 'Order placed successfully' },
        { timestamp: new Date(Date.now() - 1.8 * 60 * 60 * 1000), status: 'confirmed', message: 'Pharmacy confirmed order' },
        { timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000), status: 'preparing', message: 'Medicines being prepared' },
        { timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), status: 'packed', message: 'Order packed and ready' },
        { timestamp: new Date(Date.now() - 30 * 60 * 1000), status: 'out_for_delivery', message: 'Out for delivery' },
      ],
      deliveryAgent: {
        name: 'Ramesh Kumar',
        phone: '+91-98765-99999',
      },
    };
  }

  /**
   * Check medicine availability
   */
  async checkAvailability(medicineIds: string[], pharmacyId?: string): Promise<Record<string, boolean>> {
    const availability: Record<string, boolean> = {};
    
    for (const id of medicineIds) {
      availability[id] = true; // Mock: all available
    }

    return availability;
  }

  /**
   * Get generic substitutes for a medicine
   */
  async getSubstitutes(medicineId: string): Promise<Medicine[]> {
    const medicines = await this.searchMedicines('');
    const medicine = medicines.find(m => m.id === medicineId);
    
    if (!medicine) return [];

    // Find medicines with same generic name
    return medicines.filter(m => 
      m.id !== medicineId && 
      m.genericName.toLowerCase() === medicine.genericName.toLowerCase()
    );
  }

  /**
   * Calculate order total
   */
  async calculateTotal(medicines: { medicineId: string; quantity: number }[]): Promise<{
    subtotal: number;
    deliveryCharge: number;
    total: number;
    savings: number;
  }> {
    const allMedicines = await this.searchMedicines('');
    let subtotal = 0;
    let mrpTotal = 0;

    for (const item of medicines) {
      const med = allMedicines.find(m => m.id === item.medicineId);
      if (med) {
        subtotal += (med.discountedPrice || med.mrp) * item.quantity;
        mrpTotal += med.mrp * item.quantity;
      }
    }

    const deliveryCharge = subtotal > 500 ? 0 : 40;
    const total = subtotal + deliveryCharge;
    const savings = mrpTotal - subtotal;

    return { subtotal, deliveryCharge, total, savings };
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, reason: string): Promise<boolean> {
    this.logger.log(`Cancelling order ${orderId}: ${reason}`);
    // In production, call pharmacy API
    return true;
  }

  /**
   * Verify prescription with pharmacy
   */
  async verifyPrescription(prescriptionId: string, pharmacyId: string): Promise<{
    valid: boolean;
    message: string;
  }> {
    this.logger.log(`Verifying prescription ${prescriptionId} with pharmacy ${pharmacyId}`);
    
    // In production, validate prescription exists and is approved
    return {
      valid: true,
      message: 'Prescription verified successfully',
    };
  }
}
