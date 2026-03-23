import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { User } from '../user/user.schema';

/**
 * ABDM (Ayushman Bharat Digital Mission) Service
 *
 * In production, integrate with:
 * - EHR.Network ABDMc APIs (recommended middleware)
 * - Or directly with NHA (National Health Authority) APIs
 *
 * This service provides the interface for:
 * 1. ABHA (Ayushman Bharat Health Account) creation
 * 2. ABHA linking to existing accounts
 * 3. Care context discovery
 * 4. Consent management
 * 5. Health record fetching (FHIR format)
 */

export interface AbhaEnrollRequest {
  method: 'aadhaar' | 'mobile';
  identifier: string; // Aadhaar number or mobile number
}

export interface CareContext {
  referenceNumber: string;
  display: string;
  hiType: string;
  facility: string;
}

@Injectable()
export class AbdmService {
  private abdmBaseUrl: string;

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private config: ConfigService,
  ) {
    // EHR.Network or direct NHA sandbox URL
    this.abdmBaseUrl = this.config.get(
      'ABDM_BASE_URL',
      'https://dev.abdm.gov.in/gateway',
    );
  }

  async initiateEnrollment(
    userId: string,
    request: AbhaEnrollRequest,
  ): Promise<{ txnId: string; message: string }> {
    // In production: Call ABDM API to initiate ABHA creation
    // POST /v1/registration/aadhaar/generateOtp OR
    // POST /v1/registration/mobile/generateOtp

    // Simulated response for development
    const txnId = `txn_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    console.log(`[ABDM] Enrollment initiated for user ${userId} via ${request.method}`);

    return {
      txnId,
      message: `OTP sent to your ${request.method === 'aadhaar' ? 'Aadhaar-linked mobile' : 'mobile number'}`,
    };
  }

  async verifyEnrollmentOtp(
    userId: string,
    txnId: string,
    otp: string,
  ): Promise<{ abhaNumber: string; abhaAddress: string }> {
    // In production: Verify OTP with ABDM and get ABHA number
    // POST /v1/registration/aadhaar/verifyOtp

    // Simulated for development
    const abhaNumber = `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const abhaAddress = `user${Date.now()}@abdm`;

    // Update user record
    await this.userModel.findByIdAndUpdate(userId, { abhaAddress });

    console.log(`[ABDM] ABHA created: ${abhaNumber} for user ${userId}`);

    return { abhaNumber, abhaAddress };
  }

  async linkExistingAbha(
    userId: string,
    abhaAddress: string,
  ): Promise<{ success: boolean; message: string }> {
    // In production: Verify ABHA exists and link to user
    await this.userModel.findByIdAndUpdate(userId, { abhaAddress });

    return { success: true, message: 'ABHA linked successfully' };
  }

  async discoverCareContexts(
    userId: string,
  ): Promise<CareContext[]> {
    const user = await this.userModel.findById(userId);
    if (!user?.abhaAddress) {
      throw new BadRequestException('No ABHA linked to this account');
    }

    // In production: Call ABDM discovery API
    // POST /v0.5/care-contexts/discover

    // Simulated care contexts for development
    return [
      {
        referenceNumber: 'CC001',
        display: 'Visit to Apollo Hospital - Dec 2025',
        hiType: 'DiagnosticReport',
        facility: 'Apollo Hospitals, Chennai',
      },
      {
        referenceNumber: 'CC002',
        display: 'Lab Tests - Nov 2025',
        hiType: 'DiagnosticReport',
        facility: 'Dr. Lal PathLabs',
      },
      {
        referenceNumber: 'CC003',
        display: 'OPD Consultation - Oct 2025',
        hiType: 'Prescription',
        facility: 'AIIMS Delhi',
      },
    ];
  }

  async requestConsent(
    userId: string,
    careContextIds: string[],
    purpose: string,
  ): Promise<{ consentRequestId: string; status: string }> {
    const user = await this.userModel.findById(userId);
    if (!user?.abhaAddress) {
      throw new BadRequestException('No ABHA linked');
    }

    // In production: POST /v0.5/consent-requests/init
    const consentRequestId = `cr_${Date.now()}`;

    return { consentRequestId, status: 'REQUESTED' };
  }

  async fetchHealthRecords(
    userId: string,
    consentId: string,
  ): Promise<any[]> {
    // In production: After consent is granted via webhook,
    // fetch FHIR records from the health information providers

    // Simulated FHIR-like data
    return [
      {
        resourceType: 'DiagnosticReport',
        id: 'dr-001',
        status: 'final',
        code: { text: 'Blood Test Panel' },
        issued: '2025-12-15T10:00:00Z',
        result: [
          { display: 'HbA1c', valueQuantity: { value: 8.2, unit: '%' } },
          { display: 'Fasting Glucose', valueQuantity: { value: 156, unit: 'mg/dL' } },
          { display: 'Cholesterol Total', valueQuantity: { value: 220, unit: 'mg/dL' } },
        ],
      },
    ];
  }

  // Webhook handlers for ABDM callbacks
  async handleConsentNotification(payload: any): Promise<void> {
    console.log('[ABDM] Consent notification received:', payload);
    // Process consent grant/deny and trigger data fetch
  }

  async handleDataNotification(payload: any): Promise<void> {
    console.log('[ABDM] Data notification received:', payload);
    // Process incoming health records
  }
}
