import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { firstValueFrom } from 'rxjs';

export interface LabTest {
  code: string;
  name: string;
  description: string;
  price: number;
  preparationInstructions?: string;
  fastingRequired: boolean;
  turnaroundTimeHours: number;
  category: string;
}

export interface LabBookingRequest {
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientAddress: string;
  tests: string[]; // test codes
  prescriptionId?: string;
  preferredDate?: Date;
  homeCollection: boolean;
  notes?: string;
}

export interface LabBookingResponse {
  bookingId: string;
  status: 'confirmed' | 'pending' | 'failed';
  estimatedCollectionTime?: Date;
  phlebotomistName?: string;
  phlebotomistPhone?: string;
  totalAmount: number;
  paymentLink?: string;
  trackingUrl?: string;
}

export interface LabResult {
  bookingId: string;
  patientId: string;
  testResults: TestResult[];
  reportUrl: string;
  collectedAt: Date;
  reportedAt: Date;
  isAbnormal: boolean;
  criticalValues: CriticalValue[];
}

export interface TestResult {
  testCode: string;
  testName: string;
  value: string | number;
  unit: string;
  referenceRange: string;
  isAbnormal: boolean;
  interpretation?: string;
}

export interface CriticalValue {
  testName: string;
  value: string;
  severity: 'critical' | 'high' | 'moderate';
  actionRequired: string;
}

@Injectable()
export class LabIntegrationService {
  private readonly logger = new Logger(LabIntegrationService.name);
  
  // Simulated lab partner configurations
  private readonly labPartners = {
    thyrocare: {
      name: 'Thyrocare',
      baseUrl: process.env.THYROCARE_API_URL || 'https://api.thyrocare.com',
      apiKey: process.env.THYROCARE_API_KEY,
      webhookSecret: process.env.THYROCARE_WEBHOOK_SECRET,
    },
    healthians: {
      name: 'Healthians',
      baseUrl: process.env.HEALTHIANS_API_URL || 'https://api.healthians.com',
      apiKey: process.env.HEALTHIANS_API_KEY,
      webhookSecret: process.env.HEALTHIANS_WEBHOOK_SECRET,
    },
  };

  // Common lab tests catalog
  private readonly testCatalog: LabTest[] = [
    {
      code: 'CBC',
      name: 'Complete Blood Count (CBC)',
      description: 'Measures red blood cells, white blood cells, and platelets',
      price: 350,
      fastingRequired: false,
      turnaroundTimeHours: 12,
      category: 'Hematology',
    },
    {
      code: 'HBA1C',
      name: 'HbA1c (Glycosylated Hemoglobin)',
      description: '3-month average blood sugar level',
      price: 450,
      fastingRequired: false,
      turnaroundTimeHours: 24,
      category: 'Diabetes',
    },
    {
      code: 'LIPID',
      name: 'Lipid Profile',
      description: 'Cholesterol and triglyceride levels',
      price: 550,
      fastingRequired: true,
      preparationInstructions: '12 hours fasting required',
      turnaroundTimeHours: 12,
      category: 'Cardiac',
    },
    {
      code: 'TSH',
      name: 'Thyroid Stimulating Hormone (TSH)',
      description: 'Thyroid function test',
      price: 300,
      fastingRequired: false,
      turnaroundTimeHours: 24,
      category: 'Thyroid',
    },
    {
      code: 'KFT',
      name: 'Kidney Function Test (KFT)',
      description: 'Creatinine, BUN, uric acid levels',
      price: 650,
      fastingRequired: false,
      turnaroundTimeHours: 12,
      category: 'Renal',
    },
    {
      code: 'LFT',
      name: 'Liver Function Test (LFT)',
      description: 'SGPT, SGOT, bilirubin, albumin',
      price: 750,
      fastingRequired: false,
      turnaroundTimeHours: 12,
      category: 'Hepatic',
    },
    {
      code: 'VITD',
      name: 'Vitamin D Total',
      description: '25-Hydroxy Vitamin D level',
      price: 1200,
      fastingRequired: false,
      turnaroundTimeHours: 48,
      category: 'Vitamins',
    },
    {
      code: 'VITB12',
      name: 'Vitamin B12',
      description: 'Cobalamin level',
      price: 800,
      fastingRequired: false,
      turnaroundTimeHours: 48,
      category: 'Vitamins',
    },
    {
      code: 'HBSAG',
      name: 'Hepatitis B Surface Antigen',
      description: 'HBV infection screening',
      price: 550,
      fastingRequired: false,
      turnaroundTimeHours: 24,
      category: 'Infectious',
    },
    {
      code: 'HIV',
      name: 'HIV 1 & 2 Antibodies',
      description: 'HIV screening test',
      price: 650,
      fastingRequired: false,
      turnaroundTimeHours: 24,
      category: 'Infectious',
    },
  ];

  constructor(private readonly httpService: HttpService) {}

  /**
   * Get available lab tests
   */
  getTestCatalog(category?: string): LabTest[] {
    if (category) {
      return this.testCatalog.filter(t => t.category === category);
    }
    return this.testCatalog;
  }

  /**
   * Search tests by name or code
   */
  searchTests(query: string): LabTest[] {
    const lowerQuery = query.toLowerCase();
    return this.testCatalog.filter(
      t => 
        t.name.toLowerCase().includes(lowerQuery) ||
        t.code.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get recommended tests based on symptoms/conditions
   */
  getRecommendedTests(conditions: string[], symptoms: string[]): LabTest[] {
    const recommendations: LabTest[] = [];
    const lowerConditions = conditions.map(c => c.toLowerCase());
    const lowerSymptoms = symptoms.map(s => s.toLowerCase());

    // Diabetes check
    if (lowerConditions.some(c => c.includes('diabetes')) || 
        lowerSymptoms.some(s => s.includes('sugar') || s.includes('thirsty'))) {
      recommendations.push(this.testCatalog.find(t => t.code === 'HBA1C')!);
      recommendations.push(this.testCatalog.find(t => t.code === 'LIPID')!);
    }

    // Thyroid check
    if (lowerSymptoms.some(s => s.includes('weight') || s.includes('fatigue') || s.includes('hair'))) {
      recommendations.push(this.testCatalog.find(t => t.code === 'TSH')!);
    }

    // Anemia check
    if (lowerSymptoms.some(s => s.includes('tired') || s.includes('weak') || s.includes('pale'))) {
      recommendations.push(this.testCatalog.find(t => t.code === 'CBC')!);
      recommendations.push(this.testCatalog.find(t => t.code === 'VITB12')!);
    }

    // General health checkup
    if (recommendations.length === 0) {
      recommendations.push(this.testCatalog.find(t => t.code === 'CBC')!);
      recommendations.push(this.testCatalog.find(t => t.code === 'LIPID')!);
    }

    return [...new Set(recommendations)].filter(Boolean);
  }

  /**
   * Book lab tests
   */
  async bookTests(request: LabBookingRequest, partner: string = 'thyrocare'): Promise<LabBookingResponse> {
    this.logger.log(`Booking lab tests for patient ${request.patientId} via ${partner}`);

    // In production, this would call the actual lab partner API
    // For now, simulate the booking
    const testDetails = request.tests.map(code => 
      this.testCatalog.find(t => t.code === code)
    ).filter(Boolean);

    const totalAmount = testDetails.reduce((sum, t) => sum + (t?.price || 0), 0);

    // Simulate API call
    try {
      // const response = await firstValueFrom(
      //   this.httpService.post(`${this.labPartners[partner].baseUrl}/bookings`, {
      //     ...request,
      //     tests: request.tests,
      //   }, {
      //     headers: { 'Authorization': `Bearer ${this.labPartners[partner].apiKey}` }
      //   })
      // );

      // Simulated response
      const mockBookingId = `LAB${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      
      return {
        bookingId: mockBookingId,
        status: 'confirmed',
        estimatedCollectionTime: request.homeCollection 
          ? new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours from now
          : undefined,
        phlebotomistName: request.homeCollection ? 'Rajesh Kumar' : undefined,
        phlebotomistPhone: request.homeCollection ? '+91-98765-43210' : undefined,
        totalAmount,
        paymentLink: `https://payment.mediva.ai/lab/${mockBookingId}`,
        trackingUrl: `https://labs.mediva.ai/track/${mockBookingId}`,
      };
    } catch (error) {
      this.logger.error(`Lab booking failed: ${error}`);
      throw new Error('Failed to book lab tests');
    }
  }

  /**
   * Process lab results webhook
   */
  async processResults(labResult: LabResult): Promise<void> {
    this.logger.log(`Processing lab results for booking ${labResult.bookingId}`);

    // Check for critical values
    if (labResult.criticalValues.length > 0) {
      await this.handleCriticalValues(labResult);
    }

    // Store results in patient record
    // await this.storeResults(labResult);

    // Notify patient
    // await this.notificationService.sendLabResultsReady(labResult);
  }

  /**
   * Handle critical lab values
   */
  private async handleCriticalValues(labResult: LabResult): Promise<void> {
    this.logger.warn(`CRITICAL VALUES detected for patient ${labResult.patientId}`);
    
    for (const critical of labResult.criticalValues) {
      this.logger.warn(`  - ${critical.testName}: ${critical.value} (${critical.severity})`);
      
      // In production:
      // 1. Alert on-call doctor
      // 2. Send urgent notification to patient
      // 3. Create priority prescription queue item
      // 4. Log for audit
    }
  }

  /**
   * Get AI interpretation of lab results
   */
  async interpretResults(results: TestResult[], patientContext: any): Promise<string> {
    // This would integrate with the chat service to get AI interpretation
    const abnormalTests = results.filter(r => r.isAbnormal);
    
    if (abnormalTests.length === 0) {
      return 'All test results are within normal ranges.';
    }

    let interpretation = `Found ${abnormalTests.length} abnormal values:\n`;
    for (const test of abnormalTests) {
      interpretation += `- ${test.testName}: ${test.value} ${test.unit} (Ref: ${test.referenceRange})\n`;
      if (test.interpretation) {
        interpretation += `  ${test.interpretation}\n`;
      }
    }

    return interpretation;
  }

  /**
   * Track booking status
   */
  async getBookingStatus(bookingId: string): Promise<any> {
    // In production, call lab partner API
    return {
      bookingId,
      status: 'sample_collected',
      timeline: [
        { time: new Date(Date.now() - 24 * 60 * 60 * 1000), status: 'booked', message: 'Booking confirmed' },
        { time: new Date(Date.now() - 20 * 60 * 60 * 1000), status: 'phlebotomist_assigned', message: 'Phlebotomist assigned' },
        { time: new Date(Date.now() - 16 * 60 * 60 * 1000), status: 'sample_collected', message: 'Sample collected' },
        { time: new Date(Date.now() - 14 * 60 * 60 * 1000), status: 'lab_received', message: 'Sample received at lab' },
      ],
      estimatedReportTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
    };
  }
}
